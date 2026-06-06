import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

const uploadsDir = path.join(process.cwd(), 'uploads', 'chat')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// GET /api/chat/conversations
router.get('/conversations', requireAuth, requirePermission('chat.send'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id

    const conversations = await prisma.chatConversation.findMany({
      where: {
        participants: { some: { user_id: userId } },
      },
      orderBy: { created_at: 'desc' },
      include: {
        participants: {
          include: {
            user: { select: { id: true, login: true, discord_username: true, discord_avatar: true } },
          },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, login: true } },
          },
        },
      },
    })

    res.json(conversations)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/chat/conversations
router.post('/conversations', requireAuth, requirePermission('chat.send'), async (req: Request, res: Response) => {
  try {
    const { type, user_id } = req.body
    const currentUserId = req.user!.id

    if (type === 'DIRECT') {
      if (!user_id) {
        res.status(400).json({ error: 'user_id обязателен для DIRECT' })
        return
      }

      const existing = await prisma.chatConversation.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { participants: { some: { user_id: currentUserId } } },
            { participants: { some: { user_id: user_id as string } } },
          ],
        },
        include: { participants: true },
      })

      if (existing) {
        res.json(existing)
        return
      }

      const conv = await prisma.chatConversation.create({
        data: {
          type: 'DIRECT',
          participants: {
            create: [{ user_id: currentUserId }, { user_id: user_id as string }],
          },
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, login: true, discord_username: true } },
            },
          },
        },
      })

      res.status(201).json(conv)
    } else if (type === 'GENERAL') {
      const existing = await prisma.chatConversation.findFirst({
        where: { type: 'GENERAL' },
      })

      if (existing) {
        const already = await prisma.chatParticipant.findFirst({
          where: { conversation_id: existing.id, user_id: currentUserId },
        })
        if (!already) {
          await prisma.chatParticipant.create({
            data: { conversation_id: existing.id, user_id: currentUserId },
          })
        }
        res.json(existing)
        return
      }

      const conv = await prisma.chatConversation.create({
        data: {
          type: 'GENERAL',
          participants: {
            create: [{ user_id: currentUserId }],
          },
        },
        include: { participants: true },
      })

      res.status(201).json(conv)
    } else {
      res.status(400).json({ error: 'Неверный тип беседы' })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/chat/conversations/:id/messages
router.get('/conversations/:id/messages', requireAuth, requirePermission('chat.send'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const limit = parseInt((req.query.limit as string) || '50', 10)
    const before = req.query.before as string | undefined

    const where: { conversation_id: string; created_at?: { lt: Date } } = { conversation_id: id }
    if (before) {
      where.created_at = { lt: new Date(before) }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            login: true,
            discord_username: true,
            discord_avatar: true,
          },
        },
        attachments: true,
      },
    })

    res.json(messages.reverse())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/chat/conversations/:id/messages
router.post('/conversations/:id/messages', requireAuth, requirePermission('chat.send'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { body } = req.body
    const userId = req.user!.id

    if (!body?.trim()) {
      res.status(400).json({ error: 'body обязателен' })
      return
    }

    const conv = await prisma.chatConversation.findUnique({ where: { id } })
    if (!conv) {
      res.status(404).json({ error: 'Беседа не найдена' })
      return
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversation_id: id,
        sender_id: userId,
        body: body.trim(),
        read_by: [userId],
      },
      include: {
        sender: {
          select: {
            id: true,
            login: true,
            discord_username: true,
            discord_avatar: true,
          },
        },
        attachments: true,
      },
    })

    res.status(201).json(message)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/chat/conversations/:id/attachments
router.post('/conversations/:id/attachments', requireAuth, requirePermission('chat.send'), upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Файлы не загружены' })
      return
    }

    const conv = await prisma.chatConversation.findUnique({ where: { id } })
    if (!conv) {
      res.status(404).json({ error: 'Беседа не найдена' })
      return
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversation_id: id,
        sender_id: req.user!.id,
        body: null,
        read_by: [req.user!.id],
        attachments: {
          create: files.map((f) => ({
            filename: f.filename,
            original_name: f.originalname,
            mime_type: f.mimetype,
            size: f.size,
            url: `/uploads/chat/${f.filename}`,
          })),
        },
      },
      include: {
        sender: { select: { id: true, login: true, discord_username: true, discord_avatar: true } },
        attachments: true,
      },
    })

    res.status(201).json(message)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

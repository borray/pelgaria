import { Router, Request, Response } from 'express'
import { PrismaClient, Prisma, CitizenStatus } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

async function generateRegNumber(): Promise<string> {
  const count = await prisma.citizen.count()
  const seq = count + 1
  return `ПЕЛ-${String(seq).padStart(4, '0')}`
}

// GET /api/citizens
router.get('/', requireAuth, requirePermission('citizens.view'), async (req: Request, res: Response) => {
  try {
    const { search, status, role } = req.query as Record<string, string>

    const where: Prisma.CitizenWhereInput = {}

    if (search) {
      where.OR = [
        { nickname: { contains: search, mode: 'insensitive' } },
        { discord_username: { contains: search, mode: 'insensitive' } },
        { reg_number: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status as CitizenStatus
    }

    if (role) {
      where.role_title = { contains: role, mode: 'insensitive' }
    }

    const citizens = await prisma.citizen.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: { id: true, login: true, is_active: true },
        },
        _count: {
          select: { passports: true, cases: true, punishments: true },
        },
      },
    })

    res.json(citizens)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/citizens
router.post('/', requireAuth, requirePermission('citizens.create'), async (req: Request, res: Response) => {
  try {
    const { nickname, discord_username, role_title, status, note, joined_at } = req.body

    if (!nickname) {
      res.status(400).json({ error: 'Никнейм обязателен' })
      return
    }

    const reg_number = await generateRegNumber()

    const citizen = await prisma.citizen.create({
      data: {
        reg_number,
        nickname,
        discord_username: discord_username || null,
        role_title: role_title || 'Гражданин',
        status: status || 'ACTIVE',
        note: note || null,
        joined_at: joined_at ? new Date(joined_at) : new Date(),
      },
    })

    res.status(201).json(citizen)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/citizens/:id
router.get('/:id', requireAuth, requirePermission('citizens.view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const citizen = await prisma.citizen.findFirst({
      where: {
        OR: [{ id }, { reg_number: id }],
      },
      include: {
        user: {
          select: {
            id: true,
            login: true,
            is_active: true,
            discord_username: true,
            discord_avatar: true,
            last_login_at: true,
          },
        },
        passports: {
          orderBy: { issued_at: 'desc' },
          include: {
            issued_by: { select: { id: true, login: true } },
          },
        },
        cases: {
          orderBy: { opened_at: 'desc' },
          include: {
            law: { select: { id: true, number: true, title: true } },
            judge: { select: { id: true, login: true } },
          },
        },
        punishments: {
          orderBy: { issued_at: 'desc' },
          include: {
            issued_by: { select: { id: true, login: true } },
            revoked_by: { select: { id: true, login: true } },
          },
        },
        tax_charges: {
          orderBy: { period: { starts_at: 'desc' } },
          include: {
            period: true,
            marked_by: { select: { id: true, login: true } },
            building: { select: { id: true, reg_number: true, name: true } },
          },
        },
        buildings: {
          orderBy: { created_at: 'desc' },
        },
      },
    })

    if (!citizen) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    res.json(citizen)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/citizens/:id
router.put('/:id', requireAuth, requirePermission('citizens.edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { nickname, discord_username, role_title, status, note, joined_at } = req.body

    const existing = await prisma.citizen.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    const citizen = await prisma.citizen.update({
      where: { id },
      data: {
        nickname: nickname ?? existing.nickname,
        discord_username: discord_username !== undefined ? discord_username : existing.discord_username,
        role_title: role_title ?? existing.role_title,
        status: status ?? existing.status,
        note: note !== undefined ? note : existing.note,
        joined_at: joined_at ? new Date(joined_at) : existing.joined_at,
      },
    })

    res.json(citizen)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// DELETE /api/citizens/:id
router.delete('/:id', requireAuth, requirePermission('citizens.delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const existing = await prisma.citizen.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!existing) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    if (existing.user) {
      res.status(400).json({ error: 'Нельзя удалить гражданина, привязанного к аккаунту' })
      return
    }

    await prisma.citizen.delete({ where: { id } })

    res.json({ message: 'Гражданин удалён' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

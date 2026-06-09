import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import type { AuthUser } from './middleware/auth'
import { closePdfBrowser } from './services/pdf'

import authRouter from './routes/auth'
import citizensRouter from './routes/citizens'
import accountsRouter from './routes/accounts'
import rolesRouter from './routes/roles'
import passportsRouter from './routes/passports'
import lawsRouter from './routes/laws'
import casesRouter from './routes/cases'
import punishmentsRouter from './routes/punishments'
import taxesRouter from './routes/taxes'
import treasuryRouter from './routes/treasury'
import buildingsRouter from './routes/buildings'
import chatRouter from './routes/chat'
import discordRouter from './routes/discord'
import dashboardRouter from './routes/dashboard'
import printCenterRouter from './routes/printCenter'
import verifyRouter from './routes/verify'
import officeRouter from './routes/office'

const app = express()
const httpServer = createServer(app)
const prisma = new PrismaClient()

const CLIENT_URL = process.env.CLIENT_URL || '*'

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: CLIENT_URL !== '*',
  },
})
app.set('io', io)

app.use(
  cors({
    origin: CLIENT_URL === '*' ? true : CLIENT_URL,
    credentials: CLIENT_URL !== '*',
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

const uploadsDir = path.join(__dirname, '..', 'uploads')
app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    },
  })
)

app.use('/api/auth', authRouter)
app.use('/api/citizens', citizensRouter)
app.use('/api/accounts', accountsRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/passports', passportsRouter)
app.use('/api/laws', lawsRouter)
app.use('/api/cases', casesRouter)
app.use('/api/punishments', punishmentsRouter)
app.use('/api/taxes', taxesRouter)
app.use('/api/treasury', treasuryRouter)
app.use('/api/buildings', buildingsRouter)
app.use('/api/chat', chatRouter)
app.use('/api/auth/discord', discordRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/print-center', printCenterRouter)
app.use('/api/verify', verifyRouter)
app.use('/api/office', officeRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.io for chat
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  const secret = process.env.JWT_SECRET

  if (!token || !secret) {
    next(new Error('Требуется авторизация'))
    return
  }

  try {
    const user = jwt.verify(token, secret) as AuthUser
    if (!user.permissions?.['chat.send']) {
      next(new Error('Недостаточно прав'))
      return
    }
    socket.data.user = user
    next()
  } catch {
    next(new Error('Токен недействителен или истёк'))
  }
})

io.on('connection', (socket) => {
  const userId = (socket.data.user as AuthUser).id

  socket.join(`user:${userId}`)
  console.log(`User ${userId} connected via socket ${socket.id}`)

  socket.on('join_conversation', async (conversationId: string) => {
    const participant = await prisma.chatParticipant.findFirst({
      where: { conversation_id: conversationId, user_id: userId },
    })
    if (participant) {
      socket.join(`conv:${conversationId}`)
    }
  })

  socket.on('leave_conversation', (conversationId: string) => {
    socket.leave(`conv:${conversationId}`)
  })

  socket.on(
    'message_read',
    async (data: { conversation_id: string; message_id: string }) => {
      try {
        const participant = await prisma.chatParticipant.findFirst({
          where: { conversation_id: data.conversation_id, user_id: userId },
        })
        if (!participant) return

        const msg = await prisma.chatMessage.findFirst({
          where: { id: data.message_id, conversation_id: data.conversation_id },
        })
        if (!msg) return
        const readBy = (msg.read_by as string[]) || []
        if (!readBy.includes(userId)) {
          await prisma.chatMessage.update({
            where: { id: data.message_id },
            data: { read_by: [...readBy, userId] },
          })
        }
        // notify the sender
        io.to(`user:${msg.sender_id}`).emit('message_read', {
          conversation_id: data.conversation_id,
          message_id: data.message_id,
          read_by_user_id: userId,
        })
      } catch (err) {
        console.error('Socket message_read error:', err)
      }
    }
  )

  socket.on(
    'mark_read',
    async (data: { conversation_id: string; message_ids: string[] }) => {
      try {
        const participant = await prisma.chatParticipant.findFirst({
          where: { conversation_id: data.conversation_id, user_id: userId },
        })
        if (!participant) return

        for (const msgId of data.message_ids) {
          const msg = await prisma.chatMessage.findFirst({
            where: { id: msgId, conversation_id: data.conversation_id },
          })
          if (!msg) continue
          const readBy = (msg.read_by as string[]) || []
          if (!readBy.includes(userId)) {
            await prisma.chatMessage.update({
              where: { id: msgId },
              data: { read_by: [...readBy, userId] },
            })
          }
        }
        io.to(`conv:${data.conversation_id}`).emit('messages_read', {
          user_id: userId,
          message_ids: data.message_ids,
        })
      } catch (err) {
        console.error('Socket mark_read error:', err)
      }
    }
  )

  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`)
  })
})

const PORT = parseInt(process.env.PORT || '3001', 10)

async function ensurePermissionDefaults() {
  const roles = await prisma.role.findMany({ select: { id: true, permissions: true } })
  for (const role of roles) {
    const permissions = (role.permissions ?? {}) as Record<string, boolean>
    const canManageOffice =
      permissions['accounts.manage'] === true ||
      permissions['roles.manage'] === true ||
      permissions['cases.manage'] === true
    const canRegisterOffice = canManageOffice || permissions['citizens.create'] === true
    const canDeleteLaws = permissions['accounts.manage'] === true || permissions['roles.manage'] === true
    const defaultsPresent =
      permissions['office.view'] === true &&
      permissions['office.create'] === true &&
      (!canManageOffice || permissions['office.manage'] === true) &&
      (!canDeleteLaws || permissions['laws.delete'] === true)
    if ((!canRegisterOffice && !canDeleteLaws) || defaultsPresent) continue

    await prisma.role.update({
      where: { id: role.id },
      data: {
        permissions: {
          ...permissions,
          ...(canRegisterOffice ? {
            'office.view': true,
            'office.create': true,
            ...(canManageOffice ? { 'office.manage': true } : {}),
          } : {}),
          ...(canDeleteLaws ? { 'laws.delete': true } : {}),
        },
      },
    })
  }
}

async function start() {
  try {
    await ensurePermissionDefaults()
  } catch (error) {
    console.error('Permission defaults update failed:', error)
  }
  httpServer.listen(PORT, () => {
    console.log(`SONAR server running on port ${PORT}`)
  })
}

void start()

async function shutdown() {
  await closePdfBrowser()
  await prisma.$disconnect()
  httpServer.close(() => process.exit(0))
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)

export { io }

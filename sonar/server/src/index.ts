import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { PrismaClient } from '@prisma/client'

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
import territoriesRouter from './routes/territories'
import diplomacyRouter from './routes/diplomacy'
import chatRouter from './routes/chat'
import discordRouter from './routes/discord'

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

app.use(
  cors({
    origin: CLIENT_URL === '*' ? true : CLIENT_URL,
    credentials: CLIENT_URL !== '*',
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

const uploadsDir = path.join(__dirname, '..', 'uploads')
app.use('/uploads', express.static(uploadsDir))

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
app.use('/api/territories', territoriesRouter)
app.use('/api/diplomacy', diplomacyRouter)
app.use('/api/chat', chatRouter)
app.use('/api/auth/discord', discordRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.io for chat
const userSocketMap = new Map<string, string>()

io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId as string | undefined

  if (userId) {
    userSocketMap.set(userId, socket.id)
    socket.join(`user:${userId}`)
    console.log(`User ${userId} connected via socket ${socket.id}`)
  }

  socket.on('join_conversation', (conversationId: string) => {
    socket.join(`conv:${conversationId}`)
  })

  socket.on('leave_conversation', (conversationId: string) => {
    socket.leave(`conv:${conversationId}`)
  })

  socket.on(
    'send_message',
    async (data: {
      conversation_id: string
      body: string
      sender_id: string
      attachment_ids?: string[]
    }) => {
      try {
        const message = await prisma.chatMessage.create({
          data: {
            conversation_id: data.conversation_id,
            sender_id: data.sender_id,
            body: data.body,
            read_by: [data.sender_id],
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

        io.to(`conv:${data.conversation_id}`).emit('new_message', message)
      } catch (err) {
        console.error('Socket send_message error:', err)
        socket.emit('error', { message: 'Ошибка отправки сообщения' })
      }
    }
  )

  socket.on(
    'message_read',
    async (data: { conversation_id: string; message_id: string }) => {
      try {
        if (!userId) return
        const msg = await prisma.chatMessage.findUnique({ where: { id: data.message_id } })
        if (!msg) return
        const readBy = (msg.read_by as string[]) || []
        if (!readBy.includes(userId)) {
          await prisma.chatMessage.update({
            where: { id: data.message_id },
            data: { read_by: [...readBy, userId] },
          })
        }
        // notify the sender
        const senderSocketId = userSocketMap.get(msg.sender_id)
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_read', {
            conversation_id: data.conversation_id,
            message_id: data.message_id,
            read_by_user_id: userId,
          })
        }
      } catch (err) {
        console.error('Socket message_read error:', err)
      }
    }
  )

  socket.on(
    'mark_read',
    async (data: { conversation_id: string; user_id: string; message_ids: string[] }) => {
      try {
        for (const msgId of data.message_ids) {
          const msg = await prisma.chatMessage.findUnique({ where: { id: msgId } })
          if (!msg) continue
          const readBy = (msg.read_by as string[]) || []
          if (!readBy.includes(data.user_id)) {
            await prisma.chatMessage.update({
              where: { id: msgId },
              data: { read_by: [...readBy, data.user_id] },
            })
          }
        }
        io.to(`conv:${data.conversation_id}`).emit('messages_read', {
          user_id: data.user_id,
          message_ids: data.message_ids,
        })
      } catch (err) {
        console.error('Socket mark_read error:', err)
      }
    }
  )

  socket.on('disconnect', () => {
    if (userId) {
      userSocketMap.delete(userId)
      console.log(`User ${userId} disconnected`)
    }
  })
})

const PORT = parseInt(process.env.PORT || '3001', 10)

httpServer.listen(PORT, () => {
  console.log(`SONAR server running on port ${PORT}`)
})

export { io }

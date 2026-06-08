import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

function generateAccessToken(user: {
  id: string
  login: string
  role: { id: string; name: string; color: string }
  permissions: Record<string, boolean>
}): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.sign(user, secret, { expiresIn: '15m' })
}

function generateRefreshToken(userId: string): string {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) throw new Error('JWT_REFRESH_SECRET not configured')
  return jwt.sign({ userId }, secret, { expiresIn: '30d' })
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, password } = req.body
    if (!login || !password) {
      res.status(400).json({ error: 'Логин и пароль обязательны' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { login },
      include: { role: true },
    })

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Неверный логин или пароль' })
      return
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Неверный логин или пароль' })
      return
    }

    const permissions = (user.role.permissions as Record<string, boolean>) || {}

    const tokenPayload = {
      id: user.id,
      login: user.login,
      role: {
        id: user.role.id,
        name: user.role.name,
        color: user.role.color,
      },
      permissions,
    }

    const accessToken = generateAccessToken(tokenPayload)
    const refreshTokenStr = generateRefreshToken(user.id)

    await prisma.refreshToken.create({
      data: {
        token: refreshTokenStr,
        user_id: user.id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    })

    res.json({
      accessToken,
      refreshToken: refreshTokenStr,
      user: {
        id: user.id,
        login: user.login,
        role: tokenPayload.role,
        permissions,
        must_change_password: user.must_change_password,
        discord_username: user.discord_username,
        discord_avatar: user.discord_avatar,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token обязателен' })
      return
    }

    const secret = process.env.JWT_REFRESH_SECRET
    if (!secret) {
      res.status(500).json({ error: 'Ошибка конфигурации' })
      return
    }

    let payload: { userId: string }
    try {
      payload = jwt.verify(refreshToken, secret) as { userId: string }
    } catch {
      res.status(401).json({ error: 'Refresh token недействителен' })
      return
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    })

    if (!storedToken || storedToken.expires_at < new Date()) {
      res.status(401).json({ error: 'Refresh token истёк или не найден' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    })

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Пользователь не найден или заблокирован' })
      return
    }

    await prisma.refreshToken.delete({ where: { token: refreshToken } })

    const permissions = (user.role.permissions as Record<string, boolean>) || {}
    const tokenPayload = {
      id: user.id,
      login: user.login,
      role: { id: user.role.id, name: user.role.name, color: user.role.color },
      permissions,
    }

    const newAccessToken = generateAccessToken(tokenPayload)
    const newRefreshToken = generateRefreshToken(user.id)

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        user_id: user.id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        login: user.login,
        role: tokenPayload.role,
        permissions,
        must_change_password: user.must_change_password,
        discord_username: user.discord_username,
        discord_avatar: user.discord_avatar,
        citizen_id: user.citizen_id,
        last_login_at: user.last_login_at,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user!.id

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Текущий и новый пароли обязательны' })
      return
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' })
      return
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) {
      res.status(400).json({ error: 'Текущий пароль неверен' })
      return
    }

    const newHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash, must_change_password: false },
    })

    res.json({ message: 'Пароль успешно изменён' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { role: true },
    })

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' })
      return
    }

    res.json({
      id: user.id,
      login: user.login,
      role: {
        id: user.role.id,
        name: user.role.name,
        color: user.role.color,
      },
      permissions: (user.role.permissions as Record<string, boolean>) || {},
      must_change_password: user.must_change_password,
      discord_username: user.discord_username,
      discord_avatar: user.discord_avatar,
      citizen_id: user.citizen_id,
      last_login_at: user.last_login_at,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

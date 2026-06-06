import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

// GET /api/accounts
router.get('/', requireAuth, requirePermission('accounts.manage'), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        login: true,
        is_active: true,
        must_change_password: true,
        created_at: true,
        last_login_at: true,
        discord_username: true,
        discord_avatar: true,
        discord_id: true,
        role_id: true,
        citizen_id: true,
        role: { select: { id: true, name: true, color: true } },
        citizen: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    res.json(users)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/accounts
router.post('/', requireAuth, requirePermission('accounts.manage'), async (req: Request, res: Response) => {
  try {
    const { login, password, role_id, citizen_id } = req.body

    if (!login || !password || !role_id) {
      res.status(400).json({ error: 'Логин, пароль и роль обязательны' })
      return
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { login } })
    if (existing) {
      res.status(400).json({ error: 'Пользователь с таким логином уже существует' })
      return
    }

    const role = await prisma.role.findUnique({ where: { id: role_id } })
    if (!role) {
      res.status(400).json({ error: 'Роль не найдена' })
      return
    }

    if (citizen_id) {
      const citizen = await prisma.citizen.findUnique({ where: { id: citizen_id } })
      if (!citizen) {
        res.status(400).json({ error: 'Гражданин не найден' })
        return
      }
      const citizenHasUser = await prisma.user.findFirst({ where: { citizen_id } })
      if (citizenHasUser) {
        res.status(400).json({ error: 'У этого гражданина уже есть аккаунт' })
        return
      }
    }

    const password_hash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        login,
        password_hash,
        role_id,
        citizen_id: citizen_id || null,
        is_active: true,
        must_change_password: true,
      },
      select: {
        id: true,
        login: true,
        is_active: true,
        must_change_password: true,
        created_at: true,
        last_login_at: true,
        discord_username: true,
        discord_avatar: true,
        discord_id: true,
        role_id: true,
        citizen_id: true,
        role: { select: { id: true, name: true, color: true } },
        citizen: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    res.status(201).json(user)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/accounts/:id
router.put('/:id', requireAuth, requirePermission('accounts.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { role_id, citizen_id, is_active, discord_username, discord_id, discord_avatar } = req.body

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Аккаунт не найден' })
      return
    }

    if (role_id !== undefined) {
      const role = await prisma.role.findUnique({ where: { id: role_id as string } })
      if (!role) {
        res.status(400).json({ error: 'Роль не найдена' })
        return
      }
    }

    if (citizen_id !== undefined && citizen_id !== null) {
      const citizen = await prisma.citizen.findUnique({ where: { id: citizen_id as string } })
      if (!citizen) {
        res.status(400).json({ error: 'Гражданин не найден' })
        return
      }
      const citizenHasUser = await prisma.user.findFirst({
        where: { citizen_id: citizen_id as string, NOT: { id } },
      })
      if (citizenHasUser) {
        res.status(400).json({ error: 'У этого гражданина уже есть аккаунт' })
        return
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role_id !== undefined && { role_id: role_id as string }),
        ...(citizen_id !== undefined && { citizen_id: (citizen_id as string | null) }),
        ...(is_active !== undefined && { is_active: is_active as boolean }),
        ...(discord_username !== undefined && { discord_username: discord_username as string | null }),
        ...(discord_id !== undefined && { discord_id: discord_id as string | null }),
        ...(discord_avatar !== undefined && { discord_avatar: discord_avatar as string | null }),
      },
      include: {
        role: { select: { id: true, name: true, color: true } },
        citizen: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    res.json(user)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/accounts/:id/block
router.post('/:id/block', requireAuth, requirePermission('accounts.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Аккаунт не найден' })
      return
    }

    if (existing.id === req.user!.id) {
      res.status(400).json({ error: 'Нельзя заблокировать собственный аккаунт' })
      return
    }

    const user = await prisma.user.update({
      where: { id },
      data: { is_active: !existing.is_active },
    })

    await prisma.refreshToken.deleteMany({ where: { user_id: id } })

    res.json({
      message: user.is_active ? 'Аккаунт разблокирован' : 'Аккаунт заблокирован',
      is_active: user.is_active,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/accounts/:id/reset-password
router.post('/:id/reset-password', requireAuth, requirePermission('accounts.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Аккаунт не найден' })
      return
    }

    const password_hash = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id },
      data: { password_hash, must_change_password: true },
    })

    await prisma.refreshToken.deleteMany({ where: { user_id: id } })

    res.json({ message: 'Пароль сброшен. Пользователю необходимо сменить пароль при следующем входе.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

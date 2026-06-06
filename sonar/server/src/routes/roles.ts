import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

// GET /api/roles
router.get('/', requireAuth, requirePermission('roles.manage'), async (req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { created_at: 'asc' },
      include: {
        _count: { select: { users: true } },
      },
    })
    res.json(roles)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/roles
router.post('/', requireAuth, requirePermission('roles.manage'), async (req: Request, res: Response) => {
  try {
    const { name, color, permissions } = req.body

    if (!name) {
      res.status(400).json({ error: 'Название роли обязательно' })
      return
    }

    const existing = await prisma.role.findUnique({ where: { name } })
    if (existing) {
      res.status(400).json({ error: 'Роль с таким названием уже существует' })
      return
    }

    const role = await prisma.role.create({
      data: {
        name,
        color: color || '#6B7280',
        permissions: permissions || {},
        is_system: false,
      },
    })

    res.status(201).json(role)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/roles/:id
router.get('/:id', requireAuth, requirePermission('roles.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    })

    if (!role) {
      res.status(404).json({ error: 'Роль не найдена' })
      return
    }

    res.json(role)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/roles/:id
router.put('/:id', requireAuth, requirePermission('roles.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { name, color, permissions } = req.body

    const existing = await prisma.role.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Роль не найдена' })
      return
    }

    if (existing.is_system && name && name !== existing.name) {
      res.status(400).json({ error: 'Нельзя переименовать системную роль' })
      return
    }

    if (name && name !== existing.name) {
      const nameConflict = await prisma.role.findUnique({ where: { name } })
      if (nameConflict) {
        res.status(400).json({ error: 'Роль с таким названием уже существует' })
        return
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        color: color ?? existing.color,
        permissions: permissions !== undefined ? permissions : existing.permissions,
      },
    })

    res.json(role)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// DELETE /api/roles/:id
router.delete('/:id', requireAuth, requirePermission('roles.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })

    if (!role) {
      res.status(404).json({ error: 'Роль не найдена' })
      return
    }

    if (role.is_system) {
      res.status(400).json({ error: 'Нельзя удалить системную роль' })
      return
    }

    if (role._count.users > 0) {
      res.status(400).json({
        error: `Нельзя удалить роль: к ней привязаны пользователи (${role._count.users})`,
      })
      return
    }

    await prisma.role.delete({ where: { id } })

    res.json({ message: 'Роль удалена' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

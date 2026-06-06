import { Router, Request, Response } from 'express'
import { PrismaClient, TerritoryStatus } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

// GET /api/territories
router.get('/', requireAuth, requirePermission('territories.view'), async (_req: Request, res: Response) => {
  try {
    const territories = await prisma.territory.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        minister: { select: { id: true, login: true } },
      },
    })
    res.json(territories)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/territories
router.post('/', requireAuth, requirePermission('territories.manage'), async (req: Request, res: Response) => {
  try {
    const { name, description, minister_id, coordinates, status } = req.body
    if (!name) {
      res.status(400).json({ error: 'name обязателен' })
      return
    }

    const territory = await prisma.territory.create({
      data: {
        name,
        description: description || null,
        minister_id: minister_id || null,
        coordinates: coordinates || null,
        status: (status as TerritoryStatus) || 'NEUTRAL',
      },
      include: {
        minister: { select: { id: true, login: true } },
      },
    })

    res.status(201).json(territory)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/territories/:id
router.put('/:id', requireAuth, requirePermission('territories.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, minister_id, coordinates, status } = req.body

    const existing = await prisma.territory.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Территория не найдена' })
      return
    }

    const territory = await prisma.territory.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description !== undefined ? description : existing.description,
        minister_id: minister_id !== undefined ? (minister_id || null) : existing.minister_id,
        coordinates: coordinates !== undefined ? coordinates : existing.coordinates,
        status: (status as TerritoryStatus) ?? existing.status,
      },
      include: {
        minister: { select: { id: true, login: true } },
      },
    })

    res.json(territory)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

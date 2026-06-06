import { Router, Request, Response } from 'express'
import { PrismaClient, PunishmentType, PunishmentStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

// GET /api/punishments
router.get('/', requireAuth, requirePermission('punishments.view'), async (req: Request, res: Response) => {
  try {
    const { citizen_id, status, type } = req.query as Record<string, string>
    const where: Prisma.PunishmentWhereInput = {}
    if (citizen_id) where.citizen_id = citizen_id
    if (status) where.status = status as PunishmentStatus
    if (type) where.type = type as PunishmentType

    const punishments = await prisma.punishment.findMany({
      where,
      orderBy: { issued_at: 'desc' },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
        revoked_by: { select: { id: true, login: true } },
        case: { select: { id: true, number: true } },
      },
    })
    res.json(punishments)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/punishments
router.post('/', requireAuth, requirePermission('punishments.issue'), async (req: Request, res: Response) => {
  try {
    const { citizen_id, type, reason, case_id, expires_at } = req.body
    if (!citizen_id || !type || !reason) {
      res.status(400).json({ error: 'citizen_id, type и reason обязательны' })
      return
    }

    const citizen = await prisma.citizen.findUnique({ where: { id: citizen_id } })
    if (!citizen) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    const punishment = await prisma.punishment.create({
      data: {
        citizen_id,
        type: type as PunishmentType,
        reason,
        case_id: case_id || null,
        issued_by_id: req.user!.id,
        issued_at: new Date(),
        expires_at: expires_at ? new Date(expires_at) : null,
        status: 'ACTIVE',
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
      },
    })

    if (type === 'BAN') {
      await prisma.citizen.update({
        where: { id: citizen_id },
        data: { status: 'BANNED' },
      })
    }

    res.status(201).json(punishment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/punishments/:id/revoke
router.post('/:id/revoke', requireAuth, requirePermission('punishments.revoke'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const existing = await prisma.punishment.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Наказание не найдено' })
      return
    }

    if (existing.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Наказание уже неактивно' })
      return
    }

    const punishment = await prisma.punishment.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revoked_by_id: req.user!.id,
        revoked_at: new Date(),
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    if (existing.type === 'BAN') {
      const otherActiveBans = await prisma.punishment.count({
        where: {
          citizen_id: existing.citizen_id,
          type: 'BAN',
          status: 'ACTIVE',
          id: { not: id },
        },
      })

      if (otherActiveBans === 0) {
        await prisma.citizen.update({
          where: { id: existing.citizen_id },
          data: { status: 'ACTIVE' },
        })
      }
    }

    res.json(punishment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

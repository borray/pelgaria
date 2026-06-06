import { Router, Request, Response } from 'express'
import { PrismaClient, TaxChargeStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

// GET /api/taxes/periods
router.get('/periods', requireAuth, requirePermission('taxes.view'), async (_req: Request, res: Response) => {
  try {
    const periods = await prisma.taxPeriod.findMany({
      orderBy: { starts_at: 'desc' },
    })
    res.json(periods)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/taxes/periods
router.post('/periods', requireAuth, requirePermission('taxes.charge'), async (req: Request, res: Response) => {
  try {
    const { name, starts_at, ends_at } = req.body
    if (!name || !starts_at || !ends_at) {
      res.status(400).json({ error: 'name, starts_at и ends_at обязательны' })
      return
    }

    const period = await prisma.taxPeriod.create({
      data: {
        name,
        starts_at: new Date(starts_at),
        ends_at: new Date(ends_at),
      },
    })

    res.status(201).json(period)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/taxes/charges
router.get('/charges', requireAuth, requirePermission('taxes.view'), async (req: Request, res: Response) => {
  try {
    const { period_id, citizen_id, status } = req.query as Record<string, string>
    const where: Prisma.TaxChargeWhereInput = {}
    if (period_id) where.period_id = period_id
    if (citizen_id) where.citizen_id = citizen_id
    if (status) where.status = status as TaxChargeStatus

    const charges = await prisma.taxCharge.findMany({
      where,
      orderBy: { period: { starts_at: 'desc' } },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        period: true,
        marked_by: { select: { id: true, login: true } },
        building: { select: { id: true, reg_number: true, name: true } },
      },
    })
    res.json(charges)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/taxes/charges
router.post('/charges', requireAuth, requirePermission('taxes.charge'), async (req: Request, res: Response) => {
  try {
    const { citizen_id, period_id, amount, building_id } = req.body
    if (!citizen_id || !period_id || amount === undefined) {
      res.status(400).json({ error: 'citizen_id, period_id и amount обязательны' })
      return
    }

    const charge = await prisma.taxCharge.create({
      data: {
        citizen_id,
        period_id,
        amount: Number(amount),
        status: 'UNPAID',
        building_id: building_id || null,
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        period: true,
        building: { select: { id: true, reg_number: true, name: true } },
      },
    })

    res.status(201).json(charge)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/taxes/charges/auto  — must be before /charges/:id/pay to avoid route collision
router.post('/charges/auto', requireAuth, requirePermission('taxes.charge'), async (req: Request, res: Response) => {
  try {
    const { period_id } = req.body
    if (!period_id) {
      res.status(400).json({ error: 'period_id обязателен' })
      return
    }

    const buildings = await prisma.building.findMany({
      where: { tax_rate: { gt: 0 }, status: 'ACTIVE' },
    })

    const created: unknown[] = []
    for (const building of buildings) {
      if (!building.owner_id) continue
      const charge = await prisma.taxCharge.create({
        data: {
          citizen_id: building.owner_id,
          period_id,
          amount: building.tax_rate,
          status: 'UNPAID',
          building_id: building.id,
        },
      })
      created.push(charge)
    }

    res.status(201).json({ created: created.length, charges: created })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/taxes/charges/:id/pay
router.post('/charges/:id/pay', requireAuth, requirePermission('taxes.mark_paid'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const existing = await prisma.taxCharge.findUnique({
      where: { id },
      include: { period: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Начисление не найдено' })
      return
    }

    if (existing.status === 'PAID') {
      res.status(400).json({ error: 'Начисление уже оплачено' })
      return
    }

    const charge = await prisma.taxCharge.update({
      where: { id },
      data: {
        status: 'PAID',
        paid_at: new Date(),
        marked_by_id: req.user!.id,
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        period: true,
        marked_by: { select: { id: true, login: true } },
      },
    })

    const treasury = await prisma.treasury.findFirst()
    if (treasury) {
      await prisma.treasury.update({
        where: { id: treasury.id },
        data: { balance: { increment: existing.amount } },
      })
      await prisma.treasuryTransaction.create({
        data: {
          amount: existing.amount,
          description: `Налог [${existing.period.name}]`,
          performed_by_id: req.user!.id,
        },
      })
    }

    res.json(charge)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/taxes/summary
router.get('/summary', requireAuth, requirePermission('taxes.view'), async (req: Request, res: Response) => {
  try {
    const { period_id } = req.query as Record<string, string>
    const where: Prisma.TaxChargeWhereInput = {}
    if (period_id) where.period_id = period_id

    const charges = await prisma.taxCharge.findMany({
      where,
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    const byGitizen = new Map<string, { citizen: { id: string; reg_number: string; nickname: string }; charged: number; paid: number; debt: number }>()

    for (const c of charges) {
      if (!c.citizen) continue
      const key = c.citizen_id
      const existing = byGitizen.get(key) ?? {
        citizen: c.citizen,
        charged: 0,
        paid: 0,
        debt: 0,
      }
      existing.charged += c.amount
      if (c.status === 'PAID') existing.paid += c.amount
      byGitizen.set(key, existing)
    }

    const summary = Array.from(byGitizen.values()).map((s) => ({
      ...s,
      debt: s.charged - s.paid,
    }))

    res.json(summary)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

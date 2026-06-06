import { Router, Request, Response } from 'express'
import { PrismaClient, CaseStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

async function generateCaseNumber(): Promise<string> {
  const count = await prisma.case.count()
  const seq = count + 1
  return `СД-${String(seq).padStart(4, '0')}`
}

// GET /api/cases
router.get('/', requireAuth, requirePermission('cases.view'), async (req: Request, res: Response) => {
  try {
    const { status, accused_id } = req.query as Record<string, string>
    const where: Prisma.CaseWhereInput = {}
    if (status) where.status = status as CaseStatus
    if (accused_id) where.accused_id = accused_id

    const cases = await prisma.case.findMany({
      where,
      orderBy: { opened_at: 'desc' },
      include: {
        accused: { select: { id: true, reg_number: true, nickname: true } },
        law: { select: { id: true, number: true, title: true } },
        judge: { select: { id: true, login: true } },
        punishments: true,
      },
    })
    res.json(cases)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/cases
router.post('/', requireAuth, requirePermission('cases.create'), async (req: Request, res: Response) => {
  try {
    const { accused_id, law_id, description } = req.body
    if (!accused_id || !description) {
      res.status(400).json({ error: 'accused_id и description обязательны' })
      return
    }

    const citizen = await prisma.citizen.findUnique({ where: { id: accused_id } })
    if (!citizen) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    const number = await generateCaseNumber()

    const caseRecord = await prisma.case.create({
      data: {
        number,
        accused_id,
        law_id: law_id || null,
        description,
        status: 'OPENED',
        opened_at: new Date(),
      },
      include: {
        accused: { select: { id: true, reg_number: true, nickname: true } },
        law: { select: { id: true, number: true, title: true } },
        judge: { select: { id: true, login: true } },
      },
    })

    res.status(201).json(caseRecord)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/cases/:id
router.get('/:id', requireAuth, requirePermission('cases.view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const caseRecord = await prisma.case.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
        accused: { select: { id: true, reg_number: true, nickname: true } },
        law: { select: { id: true, number: true, title: true } },
        judge: { select: { id: true, login: true } },
        punishments: {
          include: {
            issued_by: { select: { id: true, login: true } },
          },
        },
      },
    })
    if (!caseRecord) {
      res.status(404).json({ error: 'Дело не найдено' })
      return
    }
    res.json(caseRecord)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/cases/:id
router.put('/:id', requireAuth, requirePermission('cases.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { judge_id, status, description } = req.body

    const existing = await prisma.case.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Дело не найдено' })
      return
    }

    const caseRecord = await prisma.case.update({
      where: { id },
      data: {
        ...(judge_id !== undefined && { judge_id: judge_id as string | null }),
        ...(status !== undefined && { status: status as CaseStatus }),
        ...(description !== undefined && { description: description as string }),
      },
      include: {
        accused: { select: { id: true, reg_number: true, nickname: true } },
        law: { select: { id: true, number: true, title: true } },
        judge: { select: { id: true, login: true } },
      },
    })

    res.json(caseRecord)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/cases/:id/close
router.post('/:id/close', requireAuth, requirePermission('cases.close'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { outcome, verdict_type, verdict_amount, verdict_note } = req.body

    if (!outcome) {
      res.status(400).json({ error: 'outcome обязателен' })
      return
    }

    const existing = await prisma.case.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Дело не найдено' })
      return
    }

    if (existing.status === 'CLOSED') {
      res.status(400).json({ error: 'Дело уже закрыто' })
      return
    }

    const caseRecord = await prisma.case.update({
      where: { id },
      data: {
        status: 'CLOSED',
        outcome,
        verdict_type: verdict_type || null,
        verdict_amount: verdict_amount || null,
        verdict_note: verdict_note || null,
        closed_at: new Date(),
      },
      include: {
        accused: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    if (verdict_type === 'FINE' && verdict_amount && existing.accused_id) {
      const period = await prisma.taxPeriod.findFirst({
        orderBy: { starts_at: 'desc' },
      })

      if (period) {
        await prisma.taxCharge.create({
          data: {
            citizen_id: existing.accused_id,
            period_id: period.id,
            amount: Number(verdict_amount),
            status: 'UNPAID',
          },
        })
      }
    }

    res.json(caseRecord)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

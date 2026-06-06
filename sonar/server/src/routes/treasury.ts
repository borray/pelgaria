import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

// GET /api/treasury
router.get('/', requireAuth, requirePermission('treasury.view'), async (_req: Request, res: Response) => {
  try {
    let treasury = await prisma.treasury.findFirst()
    if (!treasury) {
      treasury = await prisma.treasury.create({ data: { balance: 0 } })
    }
    res.json(treasury)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/treasury/transactions
router.get('/transactions', requireAuth, requirePermission('treasury.view'), async (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '50', 10)
    const offset = parseInt((req.query.offset as string) || '0', 10)

    const [transactions, total] = await Promise.all([
      prisma.treasuryTransaction.findMany({
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
        include: {
          performed_by: { select: { id: true, login: true } },
        },
      }),
      prisma.treasuryTransaction.count(),
    ])

    res.json({ transactions, total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/treasury/transactions
router.post('/transactions', requireAuth, requirePermission('treasury.edit'), async (req: Request, res: Response) => {
  try {
    const { amount, description } = req.body
    if (amount === undefined || !description) {
      res.status(400).json({ error: 'amount и description обязательны' })
      return
    }

    const numAmount = Number(amount)
    if (isNaN(numAmount)) {
      res.status(400).json({ error: 'amount должен быть числом' })
      return
    }

    let treasury = await prisma.treasury.findFirst()
    if (!treasury) {
      treasury = await prisma.treasury.create({ data: { balance: 0 } })
    }

    const [transaction, updatedTreasury] = await prisma.$transaction([
      prisma.treasuryTransaction.create({
        data: {
          amount: numAmount,
          description,
          performed_by_id: req.user!.id,
        },
        include: {
          performed_by: { select: { id: true, login: true } },
        },
      }),
      prisma.treasury.update({
        where: { id: treasury.id },
        data: { balance: { increment: numAmount } },
      }),
    ])

    res.status(201).json({ transaction, balance: updatedTreasury.balance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

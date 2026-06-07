import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

function can(req: Request, permission: string): boolean {
  return req.user?.permissions?.[permission] === true
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const [
      citizens,
      activeCases,
      unpaidTaxes,
      treasury,
      activeLaws,
      buildings,
      recentCases,
      recentTransactions,
      recentCitizens,
    ] = await Promise.all([
      can(req, 'citizens.view') ? prisma.citizen.count() : null,
      can(req, 'cases.view')
        ? prisma.case.count({ where: { status: { in: ['OPENED', 'IN_PROGRESS'] } } })
        : null,
      can(req, 'taxes.view')
        ? prisma.taxCharge.aggregate({
            where: { status: 'UNPAID' },
            _count: true,
            _sum: { amount: true },
          })
        : null,
      can(req, 'treasury.view') ? prisma.treasury.findFirst({ select: { balance: true } }) : null,
      can(req, 'laws.view') ? prisma.law.count({ where: { status: 'ACTIVE' } }) : null,
      can(req, 'relict.view') ? prisma.building.count({ where: { status: 'ACTIVE' } }) : null,
      can(req, 'cases.view')
        ? prisma.case.findMany({
            orderBy: { opened_at: 'desc' },
            take: 4,
            select: {
              id: true,
              number: true,
              status: true,
              opened_at: true,
              accused: { select: { nickname: true } },
            },
          })
        : [],
      can(req, 'treasury.view')
        ? prisma.treasuryTransaction.findMany({
            orderBy: { created_at: 'desc' },
            take: 4,
            select: {
              id: true,
              amount: true,
              description: true,
              created_at: true,
              performed_by: { select: { login: true } },
            },
          })
        : [],
      can(req, 'citizens.view')
        ? prisma.citizen.findMany({
            orderBy: { created_at: 'desc' },
            take: 4,
            select: {
              id: true,
              nickname: true,
              reg_number: true,
              created_at: true,
            },
          })
        : [],
    ])

    res.json({
      metrics: {
        citizens,
        active_cases: activeCases,
        unpaid_taxes_count: unpaidTaxes?._count ?? null,
        unpaid_taxes_amount: unpaidTaxes?._sum.amount ?? null,
        treasury_balance: treasury?.balance ?? null,
        active_laws: activeLaws,
        active_buildings: buildings,
      },
      recent: {
        cases: recentCases,
        transactions: recentTransactions,
        citizens: recentCitizens,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

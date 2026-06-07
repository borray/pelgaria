import { Router, Request, Response } from 'express'
import { PrismaClient, TaxChargeStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import {
  guillocheRosette,
  sealBlock,
  pageShell,
  ACCENT,
  INK,
} from '../services/templates'

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

// GET /api/taxes/periods/:id/pdf
router.get('/periods/:id/pdf', requireAuth, requirePermission('taxes.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const period = await prisma.taxPeriod.findUnique({ where: { id } })
    if (!period) {
      res.status(404).json({ error: 'Период не найден' })
      return
    }

    const charges = await prisma.taxCharge.findMany({
      where: { period_id: id },
      orderBy: [{ status: 'asc' }, { citizen: { nickname: 'asc' } }],
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        marked_by: { select: { id: true, login: true } },
      },
    })

    const seed = period.name + ':' + id.slice(0, 8)
    const printDate = new Date().toLocaleDateString('ru-RU')
    const startsDate = new Date(period.starts_at).toLocaleDateString('ru-RU')
    const endsDate = new Date(period.ends_at).toLocaleDateString('ru-RU')

    const totalCharged = charges.reduce((s, c) => s + c.amount, 0)
    const totalPaid = charges.filter((c) => c.status === 'PAID').reduce((s, c) => s + c.amount, 0)
    const totalDebt = totalCharged - totalPaid

    const statusLabels: Record<TaxChargeStatus, string> = { UNPAID: 'Не оплачен', PAID: 'Оплачен', CANCELLED: 'Отменён' }
    const statusColors: Record<TaxChargeStatus, string> = { UNPAID: '#DC2626', PAID: '#16A34A', CANCELLED: '#6B7280' }

    const rowsHtml = charges.map((c, i) => `
      <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#F9FAFB'};">
        <td style="padding:7px 10px;font-size:12px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${i + 1}</td>
        <td style="padding:7px 10px;font-size:13px;font-weight:500;color:#0A1628;border-bottom:1px solid #F3F4F6;">${c.citizen?.nickname ?? '—'}</td>
        <td style="padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">${c.amount}</td>
        <td style="padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#16A34A;border-bottom:1px solid #F3F4F6;">${c.status === 'PAID' ? c.amount : 0}</td>
        <td style="padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;color:${c.status === 'PAID' ? '#16A34A' : '#DC2626'};font-weight:600;border-bottom:1px solid #F3F4F6;">${c.status === 'PAID' ? 0 : c.amount}</td>
        <td style="padding:7px 10px;font-size:12px;font-weight:600;color:${statusColors[c.status]};border-bottom:1px solid #F3F4F6;">${statusLabels[c.status]}</td>
      </tr>`).join('')

    const seal = sealBlock({ number: `НАЛОГ-${period.name}`, signer: 'Налоговый инспектор', role: 'Налог. инспектор', date: printDate, size: 120 })

    const header = `<div class="tx-header">
      <div class="tx-emblem">${guillocheRosette(seed, 64)}</div>
      <div class="tx-head-text">
        <div class="tx-state">ГОСУДАРСТВО ПЕЛЬАГРИЯ</div>
        <div class="tx-title">НАЛОГОВАЯ ВЕДОМОСТЬ</div>
        <div class="tx-sub">Государственная информационная система СОНАР · ${printDate}</div>
      </div>
    </div>`

    const body = `
      <div class="tx-periodbar">
        <div>
          <div class="tx-label">Налоговый период</div>
          <div class="tx-period-name">${period.name}</div>
        </div>
        <div class="tx-period-dates">${startsDate} — ${endsDate}</div>
      </div>
      <table class="tx-table">
        <thead>
          <tr>
            <th style="width:38px;">№</th>
            <th>Гражданин</th>
            <th style="width:100px;text-align:right;">Начислено</th>
            <th style="width:100px;text-align:right;">Оплачено</th>
            <th style="width:90px;text-align:right;">Долг</th>
            <th style="width:100px;">Статус</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="tx-totals">
            <td></td>
            <td>ИТОГО (${charges.length} чел.)</td>
            <td style="font-family:'JetBrains Mono',monospace;text-align:right;">${totalCharged}</td>
            <td style="font-family:'JetBrains Mono',monospace;color:#16A34A;text-align:right;">${totalPaid}</td>
            <td style="font-family:'JetBrains Mono',monospace;color:${totalDebt > 0 ? '#DC2626' : '#16A34A'};text-align:right;">${totalDebt}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `

    const footer = `
      <div class="tx-footer">
        <div>
          <div class="tx-label">Дата составления</div>
          <div class="tx-foot-date">${printDate}</div>
        </div>
        <div class="tx-sign">
          ${seal}
          <div class="tx-sign-line"></div>
          <div class="tx-sign-label">Налоговый инспектор</div>
        </div>
      </div>
      <div class="tx-foot-strip">Государственная информационная система СОНАР · Дата печати: ${printDate}</div>
    `

    const styles = `
      .tx-header { display:flex; align-items:center; gap:16px; border-bottom:3px solid ${INK}; padding-bottom:14px; }
      .tx-emblem { width:54px; height:54px; flex-shrink:0; }
      .tx-emblem svg { width:54px; height:54px; }
      .tx-head-text { flex:1; text-align:center; }
      .tx-state { font-size:11px; letter-spacing:4px; color:${ACCENT}; font-weight:600; }
      .tx-title { font-size:23px; font-weight:700; letter-spacing:0.08em; color:${INK}; margin-top:4px; }
      .tx-sub { font-size:10px; color:#9CA3AF; margin-top:5px; }
      .tx-periodbar { display:flex; justify-content:space-between; align-items:center; padding:16px 18px; background:#F0F4FA; border-left:4px solid ${ACCENT}; border-radius:0 4px 4px 0; margin:20px 0; }
      .tx-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
      .tx-period-name { font-size:18px; font-weight:700; color:${INK}; }
      .tx-period-dates { font-size:13px; color:#6B7280; }
      .tx-table { width:100%; border-collapse:collapse; }
      .tx-table th { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.06em; padding:8px 10px; text-align:left; border-bottom:2px solid ${INK}; }
      .tx-totals td { padding:10px; font-size:13px; font-weight:700; color:${INK}; border-top:2px solid ${INK}; background:#F0F4FA; }
      .tx-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid ${INK}; padding-top:18px; margin-top:20px; }
      .tx-foot-date { font-size:14px; color:#374151; font-weight:500; }
      .tx-sign { text-align:center; }
      .tx-sign-line { width:200px; border-bottom:1px solid #6B7280; height:8px; margin:6px auto 0; }
      .tx-sign-label { font-size:11px; color:#6B7280; font-style:italic; margin-top:5px; }
      .tx-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:12px; }
    `

    const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, kind: 'taxes' })
    const pdfBuffer = await htmlToPdf(html)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="taxes-${period.name.replace(/\s+/g, '-')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
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

import { Router, Request, Response } from 'express'
import { PrismaClient, TaxChargeStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern } from '../services/templates'

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

    const guilloche = guillochePattern(id.slice(0, 8), 794, 40)
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

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #FFFFFF; font-family: 'Inter', sans-serif; }
  .header { background: #0A1628; height: 80px; display: flex; align-items: center; padding: 0 40px; }
  .header-left { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 3px; width: 180px; flex-shrink: 0; line-height: 1.6; }
  .header-center { flex: 1; text-align: center; }
  .header-doctype { color: #FFFFFF; font-size: 18px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .header-sub { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 3px; }
  .header-right { width: 180px; text-align: right; font-size: 12px; color: rgba(255,255,255,0.5); }
  .guilloche-bar { overflow: hidden; height: 40px; background: #F8F9FB; border-bottom: 1px solid #E5E7EB; }
  .period-banner { padding: 16px 40px; background: #F0F4FA; border-bottom: 1px solid #D0D7E3; display: flex; justify-content: space-between; align-items: center; }
  .period-name { font-size: 18px; font-weight: 700; color: #0A1628; }
  .period-dates { font-size: 13px; color: #6B7280; }
  .content { padding: 28px 40px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px; text-align: left; border-bottom: 2px solid #E5E7EB; background: #F8F9FB; }
  .totals-row td { padding: 10px 10px; font-size: 13px; font-weight: 700; color: #0A1628; border-top: 2px solid #0A1628; background: #F0F4FA; }
  .footer { border-top: 1px solid #E5E7EB; background: #F8F9FB; padding: 16px 40px; display: flex; justify-content: space-between; align-items: center; }
  .doc-footer-strip { padding: 10px 40px; display: flex; justify-content: space-between; font-size: 10px; color: #C4C9D4; border-top: 1px solid #F0F2F5; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
    <div class="header-center">
      <div class="header-doctype">Налоговая ведомость</div>
      <div class="header-sub">ГОСУДАРСТВЕННАЯ ИНФОРМАЦИОННАЯ СИСТЕМА СОНАР</div>
    </div>
    <div class="header-right">${printDate}</div>
  </div>
  <div class="guilloche-bar">${guilloche}</div>

  <div class="period-banner">
    <div>
      <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Налоговый период</div>
      <div class="period-name">${period.name}</div>
    </div>
    <div class="period-dates">${startsDate} — ${endsDate}</div>
  </div>

  <div class="content">
    <table>
      <thead>
        <tr>
          <th style="width:40px;">№</th>
          <th>Гражданин</th>
          <th style="width:100px;">Начислено</th>
          <th style="width:100px;">Оплачено</th>
          <th style="width:80px;">Долг</th>
          <th style="width:100px;">Статус</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="totals-row">
          <td></td>
          <td>ИТОГО (${charges.length} чел.)</td>
          <td style="font-family:'JetBrains Mono',monospace;">${totalCharged}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:#16A34A;">${totalPaid}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:${totalDebt > 0 ? '#DC2626' : '#16A34A'};">${totalDebt}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div style="font-size:12px;color:#6B7280;">Дата составления: ${printDate}</div>
    <div>
      <div style="width:200px;border-bottom:1px solid #6B7280;height:24px;"></div>
      <div style="font-size:11px;color:#6B7280;font-style:italic;margin-top:4px;">Налоговый инспектор</div>
    </div>
  </div>
  <div class="doc-footer-strip">
    <span>Государственная информационная система СОНАР</span>
    <span>Дата печати: ${printDate}</span>
  </div>
</body>
</html>`

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

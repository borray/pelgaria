import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern } from '../services/templates'

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

// GET /api/treasury/report/pdf
router.get('/report/pdf', requireAuth, requirePermission('treasury.view'), async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as Record<string, string>
    const where: { created_at?: { gte?: Date; lte?: Date } } = {}
    if (from || to) {
      where.created_at = {}
      if (from) where.created_at.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.created_at.lte = toDate
      }
    }

    const [treasury, transactions] = await Promise.all([
      prisma.treasury.findFirst(),
      prisma.treasuryTransaction.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: { performed_by: { select: { id: true, login: true } } },
      }),
    ])

    const guilloche = guillochePattern('treasury-report', 794, 40)
    const printDate = new Date().toLocaleDateString('ru-RU')
    const balance = treasury?.balance ?? 0

    const totalIn = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const totalOut = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)

    const periodLabel = from && to
      ? `${new Date(from).toLocaleDateString('ru-RU')} — ${new Date(to).toLocaleDateString('ru-RU')}`
      : from
      ? `с ${new Date(from).toLocaleDateString('ru-RU')}`
      : to
      ? `до ${new Date(to).toLocaleDateString('ru-RU')}`
      : 'Все время'

    const rowsHtml = transactions.map((t, i) => `
      <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#F9FAFB'};">
        <td style="padding:7px 10px;font-size:12px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${new Date(t.created_at).toLocaleDateString('ru-RU')}</td>
        <td style="padding:7px 10px;font-size:13px;color:#374151;border-bottom:1px solid #F3F4F6;">${t.description}</td>
        <td style="padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:${t.amount >= 0 ? '#16A34A' : '#DC2626'};border-bottom:1px solid #F3F4F6;">${t.amount >= 0 ? '+' : ''}${t.amount}</td>
        <td style="padding:7px 10px;font-size:12px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${t.performed_by?.login ?? '—'}</td>
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
  .header-doctype { color: #FFFFFF; font-size: 16px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .header-sub { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 3px; }
  .header-right { width: 180px; text-align: right; font-size: 12px; color: rgba(255,255,255,0.5); }
  .guilloche-bar { overflow: hidden; height: 40px; background: #F8F9FB; border-bottom: 1px solid #E5E7EB; }
  .balance-banner { padding: 20px 40px; background: #0A1628; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4A90D9; }
  .balance-label { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .balance-value { font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 700; color: #FFFFFF; }
  .balance-unit { font-size: 14px; color: rgba(255,255,255,0.5); margin-left: 8px; }
  .stats-row { display: grid; grid-template-columns: 1fr 1fr 1fr; border-bottom: 1px solid #E5E7EB; }
  .stat-cell { padding: 16px 40px; border-right: 1px solid #E5E7EB; }
  .stat-cell:last-child { border-right: none; }
  .stat-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .stat-value { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; }
  .content { padding: 24px 40px; }
  .period-label { font-size: 12px; color: #6B7280; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px; text-align: left; border-bottom: 2px solid #E5E7EB; background: #F8F9FB; }
  .footer { border-top: 1px solid #E5E7EB; background: #F8F9FB; padding: 14px 40px; display: flex; justify-content: space-between; font-size: 12px; color: #6B7280; }
  .doc-footer-strip { padding: 10px 40px; display: flex; justify-content: space-between; font-size: 10px; color: #C4C9D4; border-top: 1px solid #F0F2F5; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
    <div class="header-center">
      <div class="header-doctype">Финансовый отчёт государственной казны</div>
      <div class="header-sub">ГОСУДАРСТВЕННАЯ ИНФОРМАЦИОННАЯ СИСТЕМА СОНАР</div>
    </div>
    <div class="header-right">${printDate}</div>
  </div>
  <div class="guilloche-bar">${guilloche}</div>

  <div class="balance-banner">
    <div>
      <div class="balance-label">Текущий баланс казны</div>
      <div>
        <span class="balance-value">${balance}</span>
        <span class="balance-unit">у.е.</span>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Период отчёта</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.7);">${periodLabel}</div>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat-cell">
      <div class="stat-label">Транзакций</div>
      <div class="stat-value" style="color:#0A1628;">${transactions.length}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Поступило</div>
      <div class="stat-value" style="color:#16A34A;">+${totalIn}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Списано</div>
      <div class="stat-value" style="color:#DC2626;">${totalOut}</div>
    </div>
  </div>

  <div class="content">
    <div class="period-label">Транзакции за период: ${periodLabel}</div>
    <table>
      <thead>
        <tr>
          <th style="width:100px;">Дата</th>
          <th>Описание</th>
          <th style="width:100px;">Сумма</th>
          <th style="width:120px;">Кто провёл</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="4" style="padding:16px 10px;text-align:center;font-size:13px;color:#9CA3AF;">Нет транзакций за выбранный период</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span>Дата составления: ${printDate}</span>
    <span>Государственная информационная система СОНАР</span>
  </div>
  <div class="doc-footer-strip">
    <span>Финансовый документ — только для уполномоченных лиц</span>
    <span>Дата печати: ${printDate}</span>
  </div>
</body>
</html>`

    const pdfBuffer = await htmlToPdf(html)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="treasury-report-${printDate.replace(/\./g, '-')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

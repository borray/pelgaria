import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
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

    const printDate = new Date().toLocaleDateString('ru-RU')
    const seed = 'КАЗНА-' + (from ?? '') + (to ?? '') + printDate
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

    const seal = sealBlock({ number: 'КАЗНА', signer: 'Казначей', role: 'Казначей', date: printDate, size: 118 })

    const header = `<div class="ts-header">
      <div class="ts-emblem">${guillocheRosette(seed, 64)}</div>
      <div class="ts-head-text">
        <div class="ts-state">ГОСУДАРСТВО ПЕЛЬАГРИЯ</div>
        <div class="ts-title">ФИНАНСОВЫЙ ОТЧЁТ КАЗНЫ</div>
        <div class="ts-sub">Государственная информационная система СОНАР · ${printDate}</div>
      </div>
    </div>`

    const body = `
      <div class="ts-balance">
        <div>
          <div class="ts-bal-label">Текущий баланс казны</div>
          <div><span class="ts-bal-value">${balance}</span><span class="ts-bal-unit">у.е.</span></div>
        </div>
        <div style="text-align:right;">
          <div class="ts-bal-label">Период отчёта</div>
          <div class="ts-bal-period">${periodLabel}</div>
        </div>
      </div>
      <div class="ts-stats">
        <div class="ts-stat"><div class="ts-stat-label">Транзакций</div><div class="ts-stat-value" style="color:${INK};">${transactions.length}</div></div>
        <div class="ts-stat"><div class="ts-stat-label">Поступило</div><div class="ts-stat-value" style="color:#16A34A;">+${totalIn}</div></div>
        <div class="ts-stat"><div class="ts-stat-label">Списано</div><div class="ts-stat-value" style="color:#DC2626;">${totalOut}</div></div>
      </div>
      <table class="ts-table">
        <thead>
          <tr>
            <th style="width:100px;">Дата</th>
            <th>Описание</th>
            <th style="width:100px;text-align:right;">Сумма</th>
            <th style="width:120px;">Кто провёл</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="4" style="padding:16px 10px;text-align:center;font-size:13px;color:#9CA3AF;">Нет транзакций за выбранный период</td></tr>`}
        </tbody>
      </table>
    `

    const footer = `
      <div class="ts-footer">
        <div>
          <div class="ts-stat-label">Дата составления</div>
          <div class="ts-foot-date">${printDate}</div>
        </div>
        <div class="ts-sign">
          ${seal}
          <div class="ts-sign-line"></div>
          <div class="ts-sign-label">Казначей государства</div>
        </div>
      </div>
      <div class="ts-foot-strip">Финансовый документ — только для уполномоченных лиц · Дата печати: ${printDate}</div>
    `

    const styles = `
      .ts-header { display:flex; align-items:center; gap:16px; border-bottom:3px solid ${INK}; padding-bottom:14px; }
      .ts-emblem { width:54px; height:54px; flex-shrink:0; }
      .ts-emblem svg { width:54px; height:54px; }
      .ts-head-text { flex:1; text-align:center; }
      .ts-state { font-size:11px; letter-spacing:4px; color:${ACCENT}; font-weight:600; }
      .ts-title { font-size:22px; font-weight:700; letter-spacing:0.08em; color:${INK}; margin-top:4px; }
      .ts-sub { font-size:10px; color:#9CA3AF; margin-top:5px; }
      .ts-balance { display:flex; justify-content:space-between; align-items:center; border:2px solid ${INK}; border-left:6px solid ${ACCENT}; border-radius:4px; padding:18px 22px; margin:20px 0 16px; }
      .ts-bal-label { font-size:10px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px; }
      .ts-bal-value { font-family:'JetBrains Mono',monospace; font-size:38px; font-weight:700; color:${INK}; }
      .ts-bal-unit { font-size:14px; color:#9CA3AF; margin-left:8px; }
      .ts-bal-period { font-size:14px; color:#374151; }
      .ts-stats { display:grid; grid-template-columns:1fr 1fr 1fr; border:1px solid #E5E7EB; border-radius:4px; margin-bottom:20px; }
      .ts-stat { padding:14px 18px; border-right:1px solid #E5E7EB; }
      .ts-stat:last-child { border-right:none; }
      .ts-stat-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px; }
      .ts-stat-value { font-family:'JetBrains Mono',monospace; font-size:18px; font-weight:700; }
      .ts-table { width:100%; border-collapse:collapse; }
      .ts-table th { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.06em; padding:8px 10px; text-align:left; border-bottom:2px solid ${INK}; }
      .ts-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid ${INK}; padding-top:18px; margin-top:20px; }
      .ts-foot-date { font-size:14px; color:#374151; font-weight:500; }
      .ts-sign { text-align:center; }
      .ts-sign-line { width:200px; border-bottom:1px solid #6B7280; height:8px; margin:6px auto 0; }
      .ts-sign-label { font-size:11px; color:#6B7280; font-style:italic; margin-top:5px; }
      .ts-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:12px; }
    `

    const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, kind: 'treasury' })
    const pdfBuffer = await htmlToPdf(html)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="treasury-report-${printDate.replace(/\./g, '-')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

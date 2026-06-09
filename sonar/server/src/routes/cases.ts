import { Router, Request, Response } from 'express'
import { PrismaClient, CaseStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { nextDocumentNumber, registryCode } from '../services/documentRegistry'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import {
  barcodeStripes,
  escapeHtml,
  guillocheRosette,
  sealBlock,
  pageShell,
  ACCENT,
  INK,
} from '../services/templates'

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
    const { status, accused_id, search } = req.query as Record<string, string>
    const where: Prisma.CaseWhereInput = {}
    if (status) where.status = status as CaseStatus
    if (accused_id) where.accused_id = accused_id
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { registry_code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { accused: { nickname: { contains: search, mode: 'insensitive' } } },
        { accused: { reg_number: { contains: search, mode: 'insensitive' } } },
      ]
    }

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
    const hydrated = await Promise.all(cases.map(async (caseRecord) => {
      if (caseRecord.registry_code) return caseRecord
      return prisma.case.update({
        where: { id: caseRecord.id },
        data: { registry_code: registryCode('СД', caseRecord.number) },
        include: {
          accused: { select: { id: true, reg_number: true, nickname: true } },
          law: { select: { id: true, number: true, title: true } },
          judge: { select: { id: true, login: true } },
          punishments: true,
        },
      })
    }))
    res.json(hydrated)
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

    const openedAt = new Date()
    const caseRecord = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, 'case', 'СД', openedAt)
      return tx.case.create({
        data: {
          number,
          registry_code: registryCode('СД', number),
          accused_id,
          law_id: law_id || null,
          description,
          status: 'OPENED',
          opened_at: openedAt,
        },
        include: {
          accused: { select: { id: true, reg_number: true, nickname: true } },
          law: { select: { id: true, number: true, title: true } },
          judge: { select: { id: true, login: true } },
        },
      })
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
    const id = req.params.id as string
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
    const id = req.params.id as string
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
    const id = req.params.id as string
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

// POST /api/cases/:id/pdf
router.post('/:id/pdf', requireAuth, requirePermission('cases.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const caseRecord = await prisma.case.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
        accused: { select: { id: true, reg_number: true, nickname: true } },
        law: { select: { id: true, number: true, title: true } },
        judge: { select: { id: true, login: true } },
      },
    })
    if (!caseRecord) {
      res.status(404).json({ error: 'Дело не найдено' })
      return
    }

    const seed = caseRecord.number
    const barcode = barcodeStripes(caseRecord.number, 260, 38)

    const outcomeLabel = caseRecord.outcome === 'ACQUITTED' ? 'ОПРАВДАТЬ' : caseRecord.outcome === 'CONVICTED' ? 'ПРИЗНАТЬ ВИНОВНЫМ' : 'РАССМОТРЕНО'
    const outcomeColor = caseRecord.outcome === 'ACQUITTED' ? '#16A34A' : caseRecord.outcome === 'CONVICTED' ? '#DC2626' : '#6B7280'
    const openedDate = new Date(caseRecord.opened_at).toLocaleDateString('ru-RU')
    const closedDate = caseRecord.closed_at ? new Date(caseRecord.closed_at).toLocaleDateString('ru-RU') : '—'

    const verdictTypeLabels: Record<string, string> = {
      WARNING: 'Предупреждение',
      FINE: 'Штраф',
      EXILE: 'Изгнание',
      OTHER: 'Иное',
    }
    const verdictLabel = caseRecord.verdict_type ? verdictTypeLabels[caseRecord.verdict_type] ?? caseRecord.verdict_type : '—'
    const judge = caseRecord.judge?.login ?? 'Не назначен'
    const seal = sealBlock({ number: caseRecord.number, signer: judge, role: 'Судья', date: closedDate !== '—' ? closedDate : openedDate, size: 134 })

    const sec = (label: string, value: string, mono = false) =>
      `<div class="cs-field"><div class="cs-label">${escapeHtml(label)}</div><div class="cs-value"${mono ? ' style="font-family:\'JetBrains Mono\',monospace;color:#1B3A6B;"' : ''}>${escapeHtml(value)}</div></div>`

    const header = `<div class="cs-header">
      <div class="cs-emblem">⚖</div>
      <div class="cs-namestate">ИМЕНЕМ ГОСУДАРСТВА ПЕЛЬГАРИЯ</div>
      <div class="cs-doctype">ПРИГОВОР СУДА</div>
      <div class="cs-num">Дело №${escapeHtml(caseRecord.number)}</div>
    </div>`

    const body = `
      <div class="cs-verdict">
        <div class="cs-verdict-label">СУД ПОСТАНОВИЛ</div>
        <div class="cs-verdict-value">${outcomeLabel}</div>
      </div>
      <div class="cs-grid">
        ${sec('Обвиняемый', caseRecord.accused?.nickname ?? '—')}
        ${sec('Рег. номер', caseRecord.accused?.reg_number ?? '—', true)}
        ${sec('Инкриминируемая статья', caseRecord.law ? `${caseRecord.law.number}: ${caseRecord.law.title}` : '—')}
        ${sec('Председательствующий судья', judge)}
        ${sec('Дата открытия дела', openedDate)}
        ${sec('Дата вынесения', closedDate)}
        ${caseRecord.verdict_type ? sec('Мера наказания', verdictLabel) : ''}
        ${caseRecord.verdict_amount ? sec('Сумма штрафа', `${caseRecord.verdict_amount} у.е.`, true) : ''}
      </div>
      <div class="cs-section-label">УСТАНОВИЛ — обстоятельства дела</div>
      <div class="cs-block">${escapeHtml(caseRecord.description)}</div>
      ${caseRecord.verdict_note ? `<div class="cs-section-label" style="margin-top:18px;">Примечание к приговору</div><div class="cs-block" style="border-left-color:${outcomeColor};">${escapeHtml(caseRecord.verdict_note)}</div>` : ''}
    `

    const footer = `
      <div class="cs-footer">
        <div class="cs-barcode">${barcode}<div class="cs-barcode-text">${escapeHtml(caseRecord.number)}</div></div>
        <div class="cs-sign">
          ${seal}
          <div class="cs-sign-line"></div>
          <div class="cs-sign-label">Судья: ${escapeHtml(judge)}</div>
        </div>
      </div>
      <div class="cs-foot-strip">Государственная информационная система СОНАР · Дата печати: ${new Date().toLocaleDateString('ru-RU')}</div>
    `

    const styles = `
      .cs-header { text-align:center; padding:8px 0 16px; border-bottom:3px double ${INK}; }
      .cs-emblem { font-size:44px; color:${ACCENT}; }
      .cs-namestate { font-family:'PT Serif',serif; font-size:17px; font-weight:700; letter-spacing:0.12em; color:${INK}; margin-top:6px; }
      .cs-doctype { font-family:'PT Serif',serif; font-size:30px; font-weight:700; letter-spacing:0.18em; color:${INK}; margin-top:10px; }
      .cs-num { font-family:'JetBrains Mono',monospace; font-size:13px; color:${ACCENT}; margin-top:8px; letter-spacing:0.08em; }
      .cs-verdict { text-align:center; border:2px solid ${outcomeColor}66; background:${outcomeColor}0D; border-radius:6px; padding:20px; margin:24px 0; }
      .cs-verdict-label { font-size:11px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.14em; margin-bottom:8px; }
      .cs-verdict-value { font-family:'PT Serif',serif; font-size:30px; font-weight:700; color:${outcomeColor}; letter-spacing:0.06em; }
      .cs-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 28px; margin-bottom:24px; }
      .cs-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
      .cs-value { font-size:14px; color:#1F2937; font-weight:500; }
      .cs-section-label { font-size:11px; font-weight:700; color:${INK}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
      .cs-block { font-family:'PT Serif',serif; font-size:14px; color:#374151; line-height:1.8; white-space:pre-wrap; background:#F8F9FB; border-left:3px solid ${ACCENT}; padding:16px 20px; border-radius:0 4px 4px 0; text-align:justify; }
      .cs-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid ${INK}; padding-top:18px; }
      .cs-barcode { display:flex; flex-direction:column; gap:4px; }
      .cs-barcode-text { font-family:'JetBrains Mono',monospace; font-size:9px; color:#9CA3AF; }
      .cs-sign { text-align:center; }
      .cs-sign-line { width:200px; border-bottom:1px solid #6B7280; height:8px; margin:6px auto 0; }
      .cs-sign-label { font-size:11px; color:#6B7280; font-style:italic; margin-top:5px; }
      .cs-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:12px; }
    `

    const watermark = `<div style="width:520px;height:520px;">${guillocheRosette(seed + ':wm', 520)}</div>`
    const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, watermark, kind: 'case' })
    const pdfBuffer = await htmlToPdf(html)
    res.set(pdfHeaders(pdfBuffer, `verdict-${caseRecord.number}.pdf`))
    res.send(pdfBuffer)
  } catch (err) {
    res.status(500).json(pdfError(err, 'case verdict'))
  }
})

// DELETE /api/cases/:id — permanent erasure
router.delete('/:id', requireAuth, requirePermission('cases.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.case.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Дело не найдено' })
      return
    }
    await prisma.case.delete({ where: { id } })
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

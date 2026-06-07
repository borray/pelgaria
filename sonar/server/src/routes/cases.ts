import { Router, Request, Response } from 'express'
import { PrismaClient, CaseStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern, barcodeStripes } from '../services/templates'

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

    const guilloche = guillochePattern(caseRecord.number, 794, 50)
    const barcode = barcodeStripes(caseRecord.number, 240, 40)

    const outcomeLabel = caseRecord.outcome === 'ACQUITTED' ? 'ОПРАВДАН' : caseRecord.outcome === 'CONVICTED' ? 'ОСУЖДЁН' : '—'
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
  .header-doctype { color: #FFFFFF; font-size: 20px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .header-number { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: #4A90D9; margin-top: 4px; }
  .header-right { width: 180px; text-align: right; font-size: 12px; color: rgba(255,255,255,0.5); }
  .guilloche-bar { overflow: hidden; height: 50px; background: #F8F9FB; border-bottom: 1px solid #E5E7EB; }
  .content { padding: 36px 40px 28px; }
  .section-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .section-value { font-size: 14px; color: #1F2937; font-weight: 500; margin-bottom: 16px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .outcome-block {
    text-align: center;
    padding: 20px;
    border: 2px solid ${outcomeColor}44;
    background: ${outcomeColor}0D;
    border-radius: 6px;
    margin-bottom: 24px;
  }
  .outcome-label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .outcome-value { font-size: 32px; font-weight: 700; color: ${outcomeColor}; letter-spacing: 0.08em; }
  .description-block { background: #F8F9FB; border-left: 3px solid #4A90D9; padding: 16px 20px; border-radius: 0 4px 4px 0; margin-bottom: 24px; }
  .description-text { font-size: 14px; color: #374151; line-height: 1.7; white-space: pre-wrap; }
  .footer { border-top: 1px solid #E5E7EB; background: #F8F9FB; padding: 20px 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig-block { text-align: right; }
  .sig-line { width: 180px; border-bottom: 1px solid #6B7280; height: 24px; margin-left: auto; }
  .sig-label { font-size: 11px; color: #6B7280; font-style: italic; margin-top: 4px; }
  .barcode-block { display: flex; flex-direction: column; align-items: center; gap: 5px; }
  .barcode-text { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #9CA3AF; }
  .doc-footer-strip { padding: 10px 40px; display: flex; justify-content: space-between; font-size: 10px; color: #C4C9D4; border-top: 1px solid #F0F2F5; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
    <div class="header-center">
      <div class="header-doctype">Приговор суда</div>
      <div class="header-number">${caseRecord.number}</div>
    </div>
    <div class="header-right">${closedDate !== '—' ? closedDate : openedDate}</div>
  </div>
  <div class="guilloche-bar">${guilloche}</div>

  <div class="content">
    <div class="outcome-block">
      <div class="outcome-label">Исход дела</div>
      <div class="outcome-value">${outcomeLabel}</div>
    </div>

    <div class="fields">
      <div>
        <div class="section-label">Обвиняемый</div>
        <div class="section-value">${caseRecord.accused?.nickname ?? '—'}</div>
      </div>
      <div>
        <div class="section-label">Рег. номер</div>
        <div class="section-value" style="font-family:'JetBrains Mono',monospace;color:#1B3A6B;">${caseRecord.accused?.reg_number ?? '—'}</div>
      </div>
      <div>
        <div class="section-label">Статья</div>
        <div class="section-value">${caseRecord.law ? `${caseRecord.law.number}: ${caseRecord.law.title}` : '—'}</div>
      </div>
      <div>
        <div class="section-label">Судья</div>
        <div class="section-value">${caseRecord.judge?.login ?? 'Не назначен'}</div>
      </div>
      <div>
        <div class="section-label">Дата открытия</div>
        <div class="section-value">${openedDate}</div>
      </div>
      <div>
        <div class="section-label">Дата закрытия</div>
        <div class="section-value">${closedDate}</div>
      </div>
      ${caseRecord.verdict_type ? `
      <div>
        <div class="section-label">Тип приговора</div>
        <div class="section-value">${verdictLabel}</div>
      </div>
      ${caseRecord.verdict_amount ? `
      <div>
        <div class="section-label">Сумма штрафа</div>
        <div class="section-value" style="font-family:'JetBrains Mono',monospace;">${caseRecord.verdict_amount} у.е.</div>
      </div>` : ''}` : ''}
    </div>

    <div>
      <div class="section-label" style="margin-bottom:8px;">Обстоятельства дела</div>
      <div class="description-block">
        <div class="description-text">${caseRecord.description}</div>
      </div>
    </div>

    ${caseRecord.verdict_note ? `
    <div>
      <div class="section-label" style="margin-bottom:8px;">Примечание к приговору</div>
      <div class="description-block" style="border-left-color: ${outcomeColor};">
        <div class="description-text">${caseRecord.verdict_note}</div>
      </div>
    </div>` : ''}
  </div>

  <div class="footer">
    <div class="barcode-block">
      ${barcode}
      <div class="barcode-text">${caseRecord.number}</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Судья: ${caseRecord.judge?.login ?? '—'}</div>
    </div>
  </div>
  <div class="doc-footer-strip">
    <span>Государственная информационная система СОНАР</span>
    <span>Дата печати: ${new Date().toLocaleDateString('ru-RU')}</span>
  </div>
</body>
</html>`

    const pdfBuffer = await htmlToPdf(html)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="verdict-${caseRecord.number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

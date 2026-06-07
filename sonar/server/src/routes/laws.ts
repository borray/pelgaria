import { Router, Request, Response } from 'express'
import { PrismaClient, LawType, LawStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import {
  guillocheRosette,
  guillocheField,
  sealBlock,
  pageShell,
  parseOptionalDate,
  A4_W,
  ACCENT,
  INK,
} from '../services/templates'
import { nextDocumentNumber, normalizeManualNumber, registryCode } from '../services/documentRegistry'

const router = Router()
const prisma = new PrismaClient()

async function renderLawPdf(law: {
  number: string
  registry_code?: string | null
  type: LawType
  title: string
  body: string
  status: LawStatus
  adopted_at: Date
  repealed_at: Date | null
}): Promise<Buffer> {
  const typeLabel = law.type === 'LAW' ? 'ЗАКОН' : 'УКАЗ'
  const seed = law.number
  const adoptedDate = law.adopted_at.toLocaleDateString('ru-RU')

  const statusLabel = law.status === 'ACTIVE' ? 'ДЕЙСТВУЕТ' : law.status === 'REPEALED' ? 'ОТМЕНЁН' : 'ПРИОСТАНОВЛЕН'
  const statusColor = law.status === 'ACTIVE' ? '#16A34A' : law.status === 'REPEALED' ? '#DC2626' : '#D97706'

  const bodyHtml = law.body
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('')

  const seal = sealBlock({ number: law.number, signer: 'Глава государства', role: 'Глава государства', date: adoptedDate, size: 138 })
  const rosette = guillocheRosette(seed, 120)
  const fieldFill = guillocheField(seed + ':fill', A4_W - 130, 70, 0.12)

  const header = `<div class="law-header">
    <div class="law-emblem">${rosette}</div>
    <div class="law-state">ГОСУДАРСТВО ПЕЛЬАГРИЯ</div>
    <div class="law-acttype">${typeLabel}</div>
    <div class="law-actsub">НОРМАТИВНЫЙ ПРАВОВОЙ АКТ · №${law.number}${law.registry_code ? ` · ${law.registry_code}` : ''}</div>
    <div class="law-rule"></div>
  </div>`

  const body = `
    <div class="law-titleblock">
      <div class="law-doc-number">${typeLabel} №${law.number}</div>
      <div class="law-title">${law.title}</div>
      <div class="law-status">${statusLabel}</div>
    </div>
    <div class="law-body">${bodyHtml}</div>
    <div class="law-fill">${fieldFill}</div>
  `

  const footer = `
    <div class="law-footer">
      <div class="law-dates">
        <div class="law-date-label">Дата принятия</div>
        <div class="law-date-value">${adoptedDate}</div>
        ${law.repealed_at ? `<div class="law-date-label" style="margin-top:10px;">Дата отмены</div><div class="law-date-value">${law.repealed_at.toLocaleDateString('ru-RU')}</div>` : ''}
      </div>
      <div class="law-sign">
        ${seal}
        <div class="law-sign-line"></div>
        <div class="law-sign-label">Глава государства</div>
      </div>
    </div>
    <div class="law-foot-strip">Государственная информационная система СОНАР · Дата печати: ${new Date().toLocaleDateString('ru-RU')}</div>
  `

  const styles = `
    .law-header { text-align:center; padding:10px 0 18px; }
    .law-emblem { width:84px; height:84px; margin:0 auto 10px; }
    .law-emblem svg { width:84px; height:84px; }
    .law-state { font-size:12px; letter-spacing:5px; color:${ACCENT}; font-weight:600; }
    .law-acttype { font-family:'PT Serif',serif; font-size:46px; font-weight:700; color:${INK}; letter-spacing:0.18em; margin-top:8px; }
    .law-actsub { font-size:11px; color:#6B7280; letter-spacing:0.18em; margin-top:6px; text-transform:uppercase; }
    .law-rule { height:3px; background:${INK}; margin:16px auto 0; width:60%; }
    .law-titleblock { text-align:center; margin:6px 0 26px; }
    .law-doc-number { font-family:'JetBrains Mono',monospace; font-size:12px; color:${ACCENT}; letter-spacing:0.1em; }
    .law-title { font-family:'PT Serif',serif; font-size:22px; font-weight:700; color:${INK}; margin-top:10px; line-height:1.4; }
    .law-status { display:inline-block; margin-top:12px; font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:${statusColor}; border:1px solid ${statusColor}55; border-radius:3px; padding:3px 12px; }
    .law-body { font-family:'PT Serif',serif; }
    .law-body p { font-size:14px; color:#1F2937; line-height:1.95; margin-bottom:6px; text-align:justify; }
    .law-body p:first-letter { }
    .law-fill { margin-top:18px; opacity:0.9; }
    .law-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid ${INK}; padding-top:18px; }
    .law-date-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.1em; }
    .law-date-value { font-size:14px; color:#374151; font-weight:500; margin-top:3px; }
    .law-sign { text-align:center; }
    .law-sign-line { width:200px; border-bottom:1px solid #6B7280; height:10px; margin:6px auto 0; }
    .law-sign-label { font-size:11px; color:#6B7280; font-style:italic; margin-top:5px; }
    .law-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:12px; }
  `

  const watermark = `<div style="width:540px;height:540px;">${guillocheRosette(seed + ':wm', 540)}</div>`

  const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, watermark, kind: 'law' })
  return htmlToPdf(html)
}

// GET /api/laws
router.get('/', requireAuth, requirePermission('laws.view'), async (req: Request, res: Response) => {
  try {
    const { type, status, search } = req.query as Record<string, string>
    const where: Prisma.LawWhereInput = {}
    if (type) where.type = type as LawType
    if (status) where.status = status as LawStatus
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
        { registry_code: { contains: search, mode: 'insensitive' } },
      ]
    }

    const laws = await prisma.law.findMany({
      where,
      orderBy: { adopted_at: 'desc' },
    })
    const normalized = await Promise.all(laws.map(async (law) => {
      if (law.registry_code) return law
      const kind = law.type === 'LAW' ? 'ЗАК' : 'УКЗ'
      return prisma.law.update({
        where: { id: law.id },
        data: { registry_code: registryCode(kind, law.number) },
      })
    }))
    res.json(normalized)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/laws
router.post('/', requireAuth, requirePermission('laws.create'), async (req: Request, res: Response) => {
  try {
    const { type, title, body, auto_number = true } = req.body
    if (!type || !title || !body) {
      res.status(400).json({ error: 'type, title и body обязательны' })
      return
    }

    let adopted_at: Date
    try {
      adopted_at = parseOptionalDate(req.body.adopted_at) ?? new Date()
    } catch {
      res.status(400).json({ error: 'Некорректная дата' })
      return
    }

    let manualNumber: string | null
    try {
      manualNumber = auto_number === false ? normalizeManualNumber(req.body.number) : null
      if (auto_number === false && !manualNumber) {
        res.status(400).json({ error: 'Укажите номер или включите автоматическую нумерацию' })
        return
      }
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Некорректный номер' })
      return
    }

    const law = await prisma.$transaction(async (tx) => {
      const kind = type === 'LAW' ? 'ЗАК' : 'УКЗ'
      const number = manualNumber ?? await nextDocumentNumber(tx, `LAW:${type}`, kind, adopted_at)
      return tx.law.create({
        data: {
          number,
          registry_code: registryCode(kind, number),
          type: type as LawType,
          title: title.trim(),
          body: body.trim(),
          status: 'ACTIVE',
          adopted_at,
        },
      })
    })

    res.status(201).json(law)
  } catch (err) {
    console.error(err)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Документ с таким номером уже существует' })
      return
    }
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/laws/:id
router.get('/:id', requireAuth, requirePermission('laws.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    let law = await prisma.law.findFirst({
      where: { OR: [{ id }, { number: id }, { registry_code: id }] },
    })
    if (!law) {
      res.status(404).json({ error: 'Закон не найден' })
      return
    }
    if (!law.registry_code) {
      const kind = law.type === 'LAW' ? 'ЗАК' : 'УКЗ'
      law = await prisma.law.update({
        where: { id: law.id },
        data: { registry_code: registryCode(kind, law.number) },
      })
    }
    res.json(law)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/laws/:id
router.put('/:id', requireAuth, requirePermission('laws.edit'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { title, body, status } = req.body

    const existing = await prisma.law.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Закон не найден' })
      return
    }

    const law = await prisma.law.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        body: body ?? existing.body,
        status: status ?? existing.status,
      },
    })

    res.json(law)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/laws/:id/repeal
router.post('/:id/repeal', requireAuth, requirePermission('laws.repeal'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const existing = await prisma.law.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Закон не найден' })
      return
    }

    const law = await prisma.law.update({
      where: { id },
      data: {
        status: 'REPEALED',
        repealed_at: new Date(),
      },
    })

    res.json(law)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/laws/:id/pdf
router.post('/:id/pdf', requireAuth, requirePermission('laws.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    let law = await prisma.law.findUnique({ where: { id } })
    if (!law) {
      res.status(404).json({ error: 'Закон не найден' })
      return
    }

    if (!law.registry_code) {
      const kind = law.type === 'LAW' ? 'ЗАК' : 'УКЗ'
      law = await prisma.law.update({
        where: { id: law.id },
        data: { registry_code: registryCode(kind, law.number) },
      })
    }
    const pdfBuffer = await renderLawPdf(law)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="law-${law.number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

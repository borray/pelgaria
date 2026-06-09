import { Router, Request, Response } from 'express'
import { PrismaClient, LawType, LawStatus, Prisma } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import {
  escapeHtml,
  sealBlock,
  pageShell,
  parseOptionalDate,
  ACCENT,
  INK,
} from '../services/templates'
import { nextDocumentNumber, normalizeManualNumber, registryCode } from '../services/documentRegistry'

const router = Router()
const prisma = new PrismaClient()

// Типы нормативных актов: метка и буквенный код для ШК
const LAW_TYPE_META: Record<LawType, { label: string; upper: string; kind: string }> = {
  LAW: { label: 'Закон', upper: 'ЗАКОН', kind: 'ЗАК' },
  DECREE: { label: 'Указ', upper: 'УКАЗ', kind: 'УКЗ' },
  CONSTITUTION: { label: 'Конституционный акт', upper: 'КОНСТИТУЦИОННЫЙ АКТ', kind: 'КНС' },
  REGULATION: { label: 'Постановление', upper: 'ПОСТАНОВЛЕНИЕ', kind: 'ПНВ' },
  ORDER: { label: 'Распоряжение', upper: 'РАСПОРЯЖЕНИЕ', kind: 'РСП' },
}

function lawKind(type: LawType): string {
  return LAW_TYPE_META[type]?.kind ?? 'ЗАК'
}

function parseKeywords(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  return [...new Set(source
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 20))]
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : null
}

// Загрузка сканов и документов к нормативным актам
const lawUploadsDir = path.join(process.cwd(), 'uploads', 'laws')
if (!fs.existsSync(lawUploadsDir)) {
  fs.mkdirSync(lawUploadsDir, { recursive: true })
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const lawUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, lawUploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 12)
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME.has(file.mimetype))
  },
})

async function renderLawPdf(law: {
  number: string
  registry_code?: string | null
  type: LawType
  title: string
  short_title?: string | null
  body: string
  authority?: string | null
  revision_number: number
  status: LawStatus
  adopted_at: Date
  effective_at: Date | null
  repealed_at: Date | null
  repeal_reason?: string | null
}): Promise<Buffer> {
  const typeLabel = LAW_TYPE_META[law.type]?.upper ?? 'НОРМАТИВНЫЙ АКТ'
  const seed = law.number
  const adoptedDate = law.adopted_at.toLocaleDateString('ru-RU')

  const statusLabel = law.status === 'ACTIVE' ? 'ДЕЙСТВУЕТ' : law.status === 'REPEALED' ? 'ОТМЕНЁН' : 'ПРИОСТАНОВЛЕН'

  const bodyHtml = law.body
    .split('\n')
    .map((line) => `<p>${line ? escapeHtml(line) : '&nbsp;'}</p>`)
    .join('')

  const signer = law.authority ?? 'Уполномоченное должностное лицо'
  const seal = sealBlock({ number: law.number, signer, role: signer, date: adoptedDate, size: 118 })

  const header = `<div class="law-header">
    <div class="law-state">ГОСУДАРСТВО ПЕЛЬГАРИЯ</div>
    <div class="law-acttype">${typeLabel}</div>
    <div class="law-actsub">НОРМАТИВНЫЙ ПРАВОВОЙ АКТ · №${escapeHtml(law.number)} · РЕДАКЦИЯ ${law.revision_number}${law.registry_code ? ` · ${escapeHtml(law.registry_code)}` : ''}</div>
    <div class="law-rule"></div>
  </div>`

  const body = `
    <div class="law-titleblock">
      <div class="law-doc-number">${typeLabel} №${escapeHtml(law.number)}</div>
      <div class="law-title">${escapeHtml(law.title)}</div>
      ${law.short_title ? `<div class="law-short-title">${escapeHtml(law.short_title)}</div>` : ''}
      <div class="law-status">${statusLabel}</div>
    </div>
    <div class="law-meta">
      <div><span>Принят</span><strong>${adoptedDate}</strong></div>
      <div><span>Вступил в силу</span><strong>${law.effective_at ? law.effective_at.toLocaleDateString('ru-RU') : 'Не указано'}</strong></div>
      <div><span>Издавший орган</span><strong>${escapeHtml(signer)}</strong></div>
    </div>
    <div class="law-body">${bodyHtml}</div>
    ${law.repeal_reason ? `<div class="law-repeal"><strong>Основание отмены:</strong> ${escapeHtml(law.repeal_reason)}</div>` : ''}
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
        <div class="law-sign-label">${escapeHtml(signer)}</div>
      </div>
    </div>
    <div class="law-foot-strip">Государственная информационная система СОНАР · Дата печати: ${new Date().toLocaleDateString('ru-RU')}</div>
  `

  const styles = `
    .law-header { text-align:center; padding:10px 0 18px; }
    .law-state { font-size:11px; letter-spacing:5px; color:#000; font-weight:700; }
    .law-acttype { font-family:'PT Serif',serif; font-size:40px; font-weight:700; color:${INK}; letter-spacing:0.12em; margin-top:8px; }
    .law-actsub { font-size:11px; color:#6B7280; letter-spacing:0.18em; margin-top:6px; text-transform:uppercase; }
    .law-rule { height:3px; background:${INK}; margin:16px auto 0; width:60%; }
    .law-titleblock { text-align:center; margin:6px 0 26px; }
    .law-doc-number { font-family:'JetBrains Mono',monospace; font-size:12px; color:${ACCENT}; letter-spacing:0.1em; }
    .law-title { font-family:'PT Serif',serif; font-size:22px; font-weight:700; color:${INK}; margin-top:10px; line-height:1.4; }
    .law-short-title { margin-top:6px; font-size:12px; color:#444; }
    .law-status { display:inline-block; margin-top:12px; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#000; border:1px solid #000; padding:4px 12px; }
    .law-meta { display:grid; grid-template-columns:repeat(3,1fr); border:1px solid #000; margin-bottom:22px; }
    .law-meta div { padding:9px 10px; border-right:1px solid #000; }.law-meta div:last-child { border-right:0; }
    .law-meta span,.law-meta strong { display:block; }.law-meta span { font-size:8px; text-transform:uppercase; letter-spacing:.08em; color:#555; }
    .law-meta strong { margin-top:4px; font-size:11px; }
    .law-body { font-family:'PT Serif',serif; }
    .law-body p { font-size:14px; color:#1F2937; line-height:1.95; margin-bottom:6px; text-align:justify; }
    .law-body p:first-letter { }
    .law-repeal { margin-top:18px; padding:10px 12px; border:2px solid #000; font-size:11px; line-height:1.5; }
    .law-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid ${INK}; padding-top:18px; }
    .law-date-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.1em; }
    .law-date-value { font-size:14px; color:#374151; font-weight:500; margin-top:3px; }
    .law-sign { text-align:center; }
    .law-sign-line { width:200px; border-bottom:1px solid #6B7280; height:10px; margin:6px auto 0; }
    .law-sign-label { font-size:11px; color:#6B7280; font-style:italic; margin-top:5px; }
    .law-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:12px; }
  `

  const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, kind: 'law' })
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
        { short_title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { authority: { contains: search, mode: 'insensitive' } },
        { keywords: { has: search } },
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
      return prisma.law.update({
        where: { id: law.id },
        data: { registry_code: registryCode(lawKind(law.type), law.number) },
      })
    }))
    res.json(normalized)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

router.get('/overview', requireAuth, requirePermission('laws.view'), async (_req: Request, res: Response) => {
  try {
    const [constitution, total, active, suspended, repealed, categories, recent] = await Promise.all([
      prisma.law.findFirst({
        where: { type: 'CONSTITUTION', status: { not: 'REPEALED' } },
        orderBy: [{ effective_at: 'desc' }, { adopted_at: 'desc' }],
        select: {
          id: true,
          number: true,
          registry_code: true,
          title: true,
          short_title: true,
          summary: true,
          status: true,
          revision_number: true,
          adopted_at: true,
          effective_at: true,
        },
      }),
      prisma.law.count(),
      prisma.law.count({ where: { status: 'ACTIVE' } }),
      prisma.law.count({ where: { status: 'SUSPENDED' } }),
      prisma.law.count({ where: { status: 'REPEALED' } }),
      prisma.law.groupBy({
        by: ['category'],
        where: { category: { not: null } },
        _count: true,
        orderBy: { _count: { category: 'desc' } },
        take: 8,
      }),
      prisma.law.findMany({
        orderBy: { updated_at: 'desc' },
        take: 5,
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          status: true,
          revision_number: true,
          updated_at: true,
        },
      }),
    ])
    res.json({ constitution, stats: { total, active, suspended, repealed }, categories, recent })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось загрузить сводку законодательства' })
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

    let effective_at: Date | null
    try {
      effective_at = parseOptionalDate(req.body.effective_at)
    } catch {
      res.status(400).json({ error: 'Некорректная дата вступления в силу' })
      return
    }

    const category = typeof req.body.category === 'string' && req.body.category.trim()
      ? req.body.category.trim().slice(0, 120)
      : null
    const summary = typeof req.body.summary === 'string' && req.body.summary.trim()
      ? req.body.summary.trim().slice(0, 600)
      : null
    const shortTitle = optionalText(req.body.short_title, 120)
    const authority = optionalText(req.body.authority, 180)
    const source = optionalText(req.body.source, 300)
    const keywords = parseKeywords(req.body.keywords)
    const parentId = typeof req.body.parent_id === 'string' && req.body.parent_id
      ? req.body.parent_id
      : null

    if (!(type in LAW_TYPE_META)) {
      res.status(400).json({ error: 'Неизвестный тип документа' })
      return
    }

    const law = await prisma.$transaction(async (tx) => {
      if (parentId) {
        const parent = await tx.law.findUnique({ where: { id: parentId }, select: { id: true } })
        if (!parent) throw new Error('PARENT_NOT_FOUND')
      }
      const kind = lawKind(type as LawType)
      const number = manualNumber ?? await nextDocumentNumber(tx, `LAW:${type}`, kind, adopted_at)
      return tx.law.create({
        data: {
          number,
          registry_code: registryCode(kind, number),
          type: type as LawType,
          category,
          title: title.trim(),
          short_title: shortTitle,
          summary,
          body: body.trim(),
          authority,
          source,
          keywords,
          parent_id: parentId,
          status: 'ACTIVE',
          adopted_at,
          effective_at,
        },
      })
    })

    res.status(201).json(law)
  } catch (err) {
    console.error(err)
    if (err instanceof Error && err.message === 'PARENT_NOT_FOUND') {
      res.status(404).json({ error: 'Базовый нормативный акт не найден' })
      return
    }
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
      include: {
        attachments: { orderBy: { uploaded_at: 'desc' } },
        parent: { select: { id: true, number: true, title: true } },
        amendments: {
          orderBy: { adopted_at: 'desc' },
          select: { id: true, number: true, title: true, status: true, adopted_at: true },
        },
        revisions: { orderBy: { revision_number: 'desc' } },
      },
    })
    if (!law) {
      res.status(404).json({ error: 'Закон не найден' })
      return
    }
    if (!law.registry_code) {
      law = await prisma.law.update({
        where: { id: law.id },
        data: { registry_code: registryCode(lawKind(law.type), law.number) },
        include: {
          attachments: { orderBy: { uploaded_at: 'desc' } },
          parent: { select: { id: true, number: true, title: true } },
          amendments: {
            orderBy: { adopted_at: 'desc' },
            select: { id: true, number: true, title: true, status: true, adopted_at: true },
          },
          revisions: { orderBy: { revision_number: 'desc' } },
        },
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
    const { title, body, status, category, summary } = req.body

    const existing = await prisma.law.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Закон не найден' })
      return
    }

    let effective_at: Date | null | undefined = undefined
    if (req.body.effective_at !== undefined) {
      try {
        effective_at = parseOptionalDate(req.body.effective_at)
      } catch {
        res.status(400).json({ error: 'Некорректная дата вступления в силу' })
        return
      }
    }

    const parentId = req.body.parent_id === null || req.body.parent_id === ''
      ? null
      : typeof req.body.parent_id === 'string'
        ? req.body.parent_id
        : existing.parent_id
    if (parentId === id) {
      res.status(400).json({ error: 'Документ не может изменять сам себя' })
      return
    }

    const law = await prisma.$transaction(async (tx) => {
      if (parentId) {
        const parent = await tx.law.findUnique({ where: { id: parentId }, select: { id: true } })
        if (!parent) throw new Error('PARENT_NOT_FOUND')
      }
      await tx.lawRevision.create({
        data: {
          law_id: existing.id,
          revision_number: existing.revision_number,
          title: existing.title,
          short_title: existing.short_title,
          summary: existing.summary,
          body: existing.body,
          category: existing.category,
          authority: existing.authority,
          source: existing.source,
          keywords: existing.keywords,
          status: existing.status,
          effective_at: existing.effective_at,
          change_note: optionalText(req.body.change_note, 500) ?? 'Обновление редакции',
          created_by: req.user!.login,
        },
      })

      return tx.law.update({
        where: { id },
        data: {
          title: title ?? existing.title,
          body: body ?? existing.body,
          status: status ?? existing.status,
          revision_number: { increment: 1 },
          parent_id: parentId,
          ...(category !== undefined ? { category: optionalText(category, 120) } : {}),
          ...(summary !== undefined ? { summary: optionalText(summary, 600) } : {}),
          ...(req.body.short_title !== undefined ? { short_title: optionalText(req.body.short_title, 120) } : {}),
          ...(req.body.authority !== undefined ? { authority: optionalText(req.body.authority, 180) } : {}),
          ...(req.body.source !== undefined ? { source: optionalText(req.body.source, 300) } : {}),
          ...(req.body.keywords !== undefined ? { keywords: parseKeywords(req.body.keywords) } : {}),
          ...(effective_at !== undefined ? { effective_at } : {}),
          ...(status === 'ACTIVE' && existing.status === 'REPEALED'
            ? { repealed_at: null, repeal_reason: null }
            : {}),
        },
        include: {
          attachments: { orderBy: { uploaded_at: 'desc' } },
          parent: { select: { id: true, number: true, title: true } },
          amendments: {
            orderBy: { adopted_at: 'desc' },
            select: { id: true, number: true, title: true, status: true, adopted_at: true },
          },
          revisions: { orderBy: { revision_number: 'desc' } },
        },
      })
    })

    res.json(law)
  } catch (err) {
    console.error(err)
    if (err instanceof Error && err.message === 'PARENT_NOT_FOUND') {
      res.status(404).json({ error: 'Базовый нормативный акт не найден' })
      return
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Конфликт номера редакции. Обновите страницу и повторите.' })
      return
    }
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

    const reason = optionalText(req.body.reason, 1000)
    const law = await prisma.$transaction(async (tx) => {
      await tx.lawRevision.create({
        data: {
          law_id: existing.id,
          revision_number: existing.revision_number,
          title: existing.title,
          short_title: existing.short_title,
          summary: existing.summary,
          body: existing.body,
          category: existing.category,
          authority: existing.authority,
          source: existing.source,
          keywords: existing.keywords,
          status: existing.status,
          effective_at: existing.effective_at,
          change_note: reason ? `Отмена акта: ${reason}` : 'Отмена нормативного акта',
          created_by: req.user!.login,
        },
      })
      return tx.law.update({
        where: { id },
        data: {
          status: 'REPEALED',
          repealed_at: new Date(),
          repeal_reason: reason,
          revision_number: { increment: 1 },
        },
        include: {
          attachments: { orderBy: { uploaded_at: 'desc' } },
          parent: { select: { id: true, number: true, title: true } },
          amendments: {
            orderBy: { adopted_at: 'desc' },
            select: { id: true, number: true, title: true, status: true, adopted_at: true },
          },
          revisions: { orderBy: { revision_number: 'desc' } },
        },
      })
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
      law = await prisma.law.update({
        where: { id: law.id },
        data: { registry_code: registryCode(lawKind(law.type), law.number) },
      })
    }
    const pdfBuffer = await renderLawPdf(law)

    res.set(pdfHeaders(pdfBuffer, `law-${law.number}.pdf`))
    res.send(pdfBuffer)
  } catch (err) {
    res.status(500).json(pdfError(err, 'law document'))
  }
})

router.delete('/:id', requireAuth, requirePermission('laws.delete'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.law.findUnique({
      where: { id },
      include: {
        attachments: true,
        _count: { select: { cases: true, amendments: true } },
      },
    })
    if (!existing) {
      res.status(404).json({ error: 'Нормативный акт не найден' })
      return
    }
    if (req.body?.confirm_number !== existing.number) {
      res.status(400).json({ error: 'Для удаления введите точный номер документа' })
      return
    }
    if (existing._count.cases > 0) {
      res.status(409).json({ error: 'Документ используется в судебных делах. Сначала измените связанные дела.' })
      return
    }
    if (existing._count.amendments > 0) {
      res.status(409).json({ error: 'К документу привязаны изменения. Сначала отвяжите или удалите их.' })
      return
    }

    await prisma.law.delete({ where: { id } })
    await Promise.all(existing.attachments.map((attachment) =>
      fs.promises.unlink(path.join(lawUploadsDir, attachment.filename)).catch(() => undefined)
    ))
    res.status(204).end()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось удалить нормативный акт' })
  }
})

// GET /api/laws/:id/attachments — список вложений (сканов/документов)
router.get('/:id/attachments', requireAuth, requirePermission('laws.view'), async (req: Request, res: Response) => {
  try {
    const law_id = req.params.id as string
    const attachments = await prisma.lawAttachment.findMany({
      where: { law_id },
      orderBy: { uploaded_at: 'desc' },
    })
    res.json(attachments)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Не удалось загрузить вложения' })
  }
})

// POST /api/laws/:id/attachments — загрузка сканов и документов
router.post('/:id/attachments', requireAuth, requirePermission('laws.edit'), lawUpload.array('files', 12), async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? []
  const removeUploadedFiles = () => Promise.all(
    files.map((file) => fs.promises.unlink(file.path).catch(() => undefined))
  )

  try {
    const law_id = req.params.id as string
    const law = await prisma.law.findUnique({ where: { id: law_id } })
    if (!law) {
      await removeUploadedFiles()
      res.status(404).json({ error: 'Закон не найден' })
      return
    }
    if (files.length === 0) {
      res.status(400).json({ error: 'Файлы не загружены или формат не поддерживается' })
      return
    }
    const kindRaw = typeof req.body.kind === 'string' ? req.body.kind.toUpperCase() : 'DOCUMENT'
    const kind = ['DOCUMENT', 'SCAN', 'APPENDIX'].includes(kindRaw) ? kindRaw : 'DOCUMENT'
    const created = await prisma.$transaction(
      files.map((f) =>
        prisma.lawAttachment.create({
          data: {
            law_id,
            kind,
            filename: f.filename,
            original_name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
            mime_type: f.mimetype,
            size: f.size,
            url: `/uploads/laws/${f.filename}`,
          },
        })
      )
    )
    res.status(201).json(created)
  } catch (err) {
    await removeUploadedFiles()
    console.error(err)
    res.status(500).json({ error: 'Не удалось загрузить вложения' })
  }
})

// DELETE /api/laws/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', requireAuth, requirePermission('laws.edit'), async (req: Request, res: Response) => {
  try {
    const attachmentId = req.params.attachmentId as string
    const lawId = req.params.id as string
    const attachment = await prisma.lawAttachment.findFirst({
      where: { id: attachmentId, law_id: lawId },
    })
    if (!attachment) {
      res.status(404).json({ error: 'Вложение не найдено' })
      return
    }
    await prisma.lawAttachment.delete({ where: { id: attachmentId } })
    const filePath = path.join(lawUploadsDir, attachment.filename)
    fs.promises.unlink(filePath).catch(() => undefined)
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Не удалось удалить вложение' })
  }
})

export default router

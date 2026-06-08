import { Router, Request, Response } from 'express'
import { PrismaClient, RelationStatus, TreatyType, TreatyStatus, Prisma } from '@prisma/client'
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

async function renderTreatyPdf(treaty: {
  number: string
  registry_code?: string | null
  type: TreatyType
  body: string
  signed_at: Date
  state: { name: string } | null
}): Promise<Buffer> {
  const typeLabels: Record<TreatyType, string> = {
    NON_AGGRESSION: 'Пакт о ненападении',
    ALLIANCE: 'Договор о союзе',
    TRADE: 'Торговый договор',
    OTHER: 'Договор',
  }
  const typeLabel = typeLabels[treaty.type] ?? 'Договор'
  const seed = treaty.number
  const signedDate = treaty.signed_at.toLocaleDateString('ru-RU')
  const partnerName = treaty.state?.name ?? 'Неизвестное государство'
  const bodyHtml = treaty.body
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('')

  const seal = sealBlock({ number: treaty.number, signer: 'Глава государства', role: 'Пельагрия', date: signedDate, size: 122 })
  const fieldFill = guillocheField(seed + ':fill', A4_W - 130, 64, 0.12)

  const header = `<div class="dp-header">
    <div class="dp-emblems">
      <div class="dp-emblem">${guillocheRosette(seed + ':a', 78)}</div>
      <div class="dp-link">⟺</div>
      <div class="dp-emblem">${guillocheRosette(seed + ':b', 78)}</div>
    </div>
    <div class="dp-doctype">МЕЖДУНАРОДНЫЙ ДОГОВОР</div>
    <div class="dp-parties"><span>ГОСУДАРСТВО ПЕЛЬАГРИЯ</span><span class="dp-amp">—</span><span>${partnerName.toUpperCase()}</span></div>
  </div>`

  const body = `
    <div class="dp-titleblock">
    <div class="dp-number">Договор №${treaty.number}${treaty.registry_code ? ` · ${treaty.registry_code}` : ''}</div>
      <div class="dp-type">${typeLabel}</div>
    </div>
    <div class="dp-body">${bodyHtml}</div>
    <div class="dp-fill">${fieldFill}</div>
  `

  const footer = `
    <div class="dp-seal-row">${seal}</div>
    <div class="dp-signatures">
      <div class="dp-sig">
        <div class="dp-sig-party">Государство Пельагрия</div>
        <div class="dp-sig-line"></div>
        <div class="dp-sig-label">Глава государства</div>
        <div class="dp-sig-date"><span class="dp-date-label">Дата подписания</span> ${signedDate}</div>
      </div>
      <div class="dp-sig">
        <div class="dp-sig-party">${partnerName}</div>
        <div class="dp-sig-line"></div>
        <div class="dp-sig-label">Уполномоченный представитель</div>
        <div class="dp-sig-date"><span class="dp-date-label">Дата подписания</span> ${signedDate}</div>
      </div>
    </div>
    <div class="dp-foot-strip">Государственная информационная система СОНАР · Дата печати: ${new Date().toLocaleDateString('ru-RU')}</div>
  `

  const styles = `
    .dp-header { text-align:center; padding:6px 0 16px; border-bottom:3px double ${INK}; }
    .dp-emblems { display:flex; align-items:center; justify-content:center; gap:24px; }
    .dp-emblem { width:60px; height:60px; }
    .dp-emblem svg { width:60px; height:60px; }
    .dp-link { font-size:26px; color:${ACCENT}; }
    .dp-doctype { font-family:'PT Serif',serif; font-size:28px; font-weight:700; letter-spacing:0.16em; color:${INK}; margin-top:12px; }
    .dp-parties { display:flex; justify-content:center; gap:14px; margin-top:10px; font-size:13px; font-weight:600; letter-spacing:0.08em; color:${ACCENT}; }
    .dp-amp { color:#9CA3AF; }
    .dp-titleblock { text-align:center; margin:22px 0 22px; }
    .dp-number { font-family:'JetBrains Mono',monospace; font-size:12px; color:${ACCENT}; letter-spacing:0.08em; }
    .dp-type { font-family:'PT Serif',serif; font-size:20px; font-weight:700; color:${INK}; margin-top:8px; }
    .dp-body { font-family:'PT Serif',serif; }
    .dp-body p { font-size:14px; color:#1F2937; line-height:1.9; margin-bottom:6px; text-align:justify; }
    .dp-fill { margin-top:16px; }
    .dp-seal-row { display:flex; justify-content:center; margin-bottom:8px; }
    .dp-signatures { display:grid; grid-template-columns:1fr 1fr; gap:40px; border-top:2px solid ${INK}; padding-top:20px; }
    .dp-sig { text-align:center; }
    .dp-sig-party { font-size:13px; font-weight:600; color:${INK}; margin-bottom:30px; }
    .dp-sig-line { border-bottom:1px solid #6B7280; height:6px; }
    .dp-sig-label { font-size:11px; color:#6B7280; font-style:italic; margin-top:6px; }
    .dp-sig-date { font-size:12px; color:#374151; margin-top:12px; }
    .dp-date-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em; }
    .dp-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:14px; }
  `

  const watermark = `<div style="width:540px;height:540px;">${guillocheRosette(seed + ':wm', 540)}</div>`
  const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, watermark, kind: 'treaty' })
  return htmlToPdf(html)
}

// GET /api/diplomacy/states
router.get('/states', requireAuth, requirePermission('diplomacy.view'), async (_req: Request, res: Response) => {
  try {
    const states = await prisma.diplomaticState.findMany({
      orderBy: { name: 'asc' },
      include: {
        treaties: { orderBy: { signed_at: 'desc' } },
      },
    })
    res.json(states)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/diplomacy/states
router.post('/states', requireAuth, requirePermission('diplomacy.manage'), async (req: Request, res: Response) => {
  try {
    const { name, relation_status, description } = req.body
    if (!name) {
      res.status(400).json({ error: 'name обязателен' })
      return
    }

    const state = await prisma.diplomaticState.create({
      data: {
        name,
        relation_status: (relation_status as RelationStatus) || 'NEUTRAL',
        description: description || null,
      },
    })

    res.status(201).json(state)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/diplomacy/states/:id
router.put('/states/:id', requireAuth, requirePermission('diplomacy.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { name, relation_status, description } = req.body

    const existing = await prisma.diplomaticState.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Государство не найдено' })
      return
    }

    const state = await prisma.diplomaticState.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        relation_status: (relation_status as RelationStatus) ?? existing.relation_status,
        description: description !== undefined ? description : existing.description,
      },
    })

    res.json(state)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// DELETE /api/diplomacy/states/:id
router.delete('/states/:id', requireAuth, requirePermission('diplomacy.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.diplomaticState.findUnique({
      where: { id },
      include: { _count: { select: { treaties: true } } },
    })
    if (!existing) {
      res.status(404).json({ error: 'Государство не найдено' })
      return
    }
    if (existing._count.treaties > 0) {
      res.status(409).json({
        error: `Нельзя удалить государство: связано договоров — ${existing._count.treaties}`,
      })
      return
    }
    await prisma.diplomaticState.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/diplomacy/treaties
router.get('/treaties', requireAuth, requirePermission('diplomacy.view'), async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const treaties = await prisma.diplomaticTreaty.findMany({
      where: search ? {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { registry_code: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
          { state: { name: { contains: search, mode: 'insensitive' } } },
        ],
      } : undefined,
      orderBy: { signed_at: 'desc' },
      include: {
        state: { select: { id: true, name: true } },
      },
    })
    const normalized = await Promise.all(treaties.map(async (treaty) => {
      if (treaty.registry_code) return treaty
      return prisma.diplomaticTreaty.update({
        where: { id: treaty.id },
        data: { registry_code: registryCode('ДПЛ', treaty.number) },
        include: { state: { select: { id: true, name: true } } },
      })
    }))
    res.json(normalized)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/diplomacy/treaties
router.post('/treaties', requireAuth, requirePermission('diplomacy.manage'), async (req: Request, res: Response) => {
  try {
    const { state_id, type, body, auto_number = true } = req.body
    if (!state_id || !type || !body) {
      res.status(400).json({ error: 'state_id, type и body обязательны' })
      return
    }

    let signed_at: Date
    try {
      signed_at = parseOptionalDate(req.body.signed_at) ?? new Date()
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

    const treaty = await prisma.$transaction(async (tx) => {
      const number = manualNumber ?? await nextDocumentNumber(tx, 'TREATY', 'ДПЛ', signed_at)
      return tx.diplomaticTreaty.create({
        data: {
          number,
          registry_code: registryCode('ДПЛ', number),
          state_id,
          type: type as TreatyType,
          body: body.trim(),
          signed_at,
          status: 'ACTIVE',
        },
        include: {
          state: { select: { id: true, name: true } },
        },
      })
    })

    res.status(201).json(treaty)
  } catch (err) {
    console.error(err)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Договор с таким номером уже существует' })
      return
    }
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/diplomacy/treaties/:id
router.put('/treaties/:id', requireAuth, requirePermission('diplomacy.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { status, body } = req.body

    const existing = await prisma.diplomaticTreaty.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Договор не найден' })
      return
    }

    const treaty = await prisma.diplomaticTreaty.update({
      where: { id },
      data: {
        status: (status as TreatyStatus) ?? existing.status,
        body: body ?? existing.body,
      },
      include: {
        state: { select: { id: true, name: true } },
      },
    })

    res.json(treaty)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// DELETE /api/diplomacy/treaties/:id
router.delete('/treaties/:id', requireAuth, requirePermission('diplomacy.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.diplomaticTreaty.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Договор не найден' })
      return
    }
    await prisma.diplomaticTreaty.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/diplomacy/treaties/:id/pdf
router.post('/treaties/:id/pdf', requireAuth, requirePermission('diplomacy.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    let treaty = await prisma.diplomaticTreaty.findUnique({
      where: { id },
      include: { state: { select: { id: true, name: true } } },
    })
    if (!treaty) {
      res.status(404).json({ error: 'Договор не найден' })
      return
    }

    if (!treaty.registry_code) {
      treaty = await prisma.diplomaticTreaty.update({
        where: { id: treaty.id },
        data: { registry_code: registryCode('ДПЛ', treaty.number) },
        include: { state: { select: { id: true, name: true } } },
      })
    }
    const pdfBuffer = await renderTreatyPdf(treaty)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="treaty-${treaty.number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

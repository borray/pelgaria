import { Router, Request, Response } from 'express'
import { PrismaClient, RelationStatus, TreatyType, TreatyStatus } from '@prisma/client'
import puppeteer from 'puppeteer-core'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

async function generateTreatyNumber(): Promise<string> {
  const count = await prisma.diplomaticTreaty.count()
  const seq = count + 1
  return `ДПЛ-${String(seq).padStart(3, '0')}`
}

function generateGuilloché(seed: string): string {
  const chars = seed.split('').map((c) => c.charCodeAt(0))
  const lines: string[] = []
  for (let i = 0; i < 6; i++) {
    const amp = 5 + (chars[i % chars.length] % 7)
    const freq = 0.012 + (chars[(i + 1) % chars.length] % 10) * 0.003
    const phase = (chars[(i + 2) % chars.length] % 10) * 0.4
    const yBase = 8 + i * 13
    const pts: string[] = []
    for (let x = 0; x <= 700; x += 5) {
      const y = yBase + amp * Math.sin(freq * x + phase)
      pts.push(`${x},${y.toFixed(2)}`)
    }
    lines.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#1B3A6B" stroke-width="0.8" opacity="0.15"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="90">${lines.join('')}</svg>`
}

async function renderTreatyPdf(treaty: {
  number: string
  type: TreatyType
  body: string
  signed_at: Date
  state: { name: string } | null
}): Promise<Buffer> {
  const guilloché = generateGuilloché(treaty.number)
  const typeLabels: Record<TreatyType, string> = {
    NON_AGGRESSION: 'Пакт о ненападении',
    ALLIANCE: 'Договор о союзе',
    TRADE: 'Торговый договор',
    OTHER: 'Договор',
  }
  const typeLabel = typeLabels[treaty.type] ?? 'Договор'
  const signedDate = treaty.signed_at.toLocaleDateString('ru-RU')
  const bodyHtml = treaty.body
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#F2F4F7; font-family:'Inter',sans-serif; padding:32px; }
  .card { background:#FFFFFF; max-width:640px; margin:0 auto; border-radius:8px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.1); }
  .header { background:#0A1628; padding:28px 36px 24px; }
  .header-state { color:rgba(255,255,255,0.5); font-size:11px; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px; }
  .header-docnum { color:#FFFFFF; font-size:22px; font-weight:700; letter-spacing:0.04em; margin-bottom:4px; }
  .header-parties { color:rgba(255,255,255,0.7); font-size:13px; }
  .guilloché { background:#F8F9FB; overflow:hidden; height:90px; }
  .body-section { padding:28px 36px; }
  .doc-title { font-size:16px; font-weight:700; color:#0A1628; margin-bottom:20px; }
  .doc-body p { font-size:14px; color:#374151; line-height:1.7; margin-bottom:8px; }
  .footer { border-top:1px solid #E5E7EB; padding:20px 36px; display:flex; justify-content:space-between; align-items:flex-end; background:#F8F9FB; }
  .date-wrap .date-label { font-size:11px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px; }
  .date-wrap .date-value { font-size:14px; color:#374151; font-weight:500; }
  .signature { font-size:12px; color:#6B7280; font-style:italic; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="header-state">Государство Пельагрия</div>
    <div class="header-docnum">Договор №${treaty.number}</div>
    <div class="header-parties">${typeLabel}${treaty.state ? ' · ' + treaty.state.name : ''}</div>
  </div>
  <div class="guilloché">${guilloché}</div>
  <div class="body-section">
    <div class="doc-title">${typeLabel}</div>
    <div class="doc-body">${bodyHtml}</div>
  </div>
  <div class="footer">
    <div class="date-wrap">
      <div class="date-label">Дата подписания</div>
      <div class="date-value">${signedDate}</div>
    </div>
    <div class="signature">Глава государства</div>
  </div>
</div>
</body>
</html>`

  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
  })
  await browser.close()
  return Buffer.from(pdfBuffer)
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

// GET /api/diplomacy/treaties
router.get('/treaties', requireAuth, requirePermission('diplomacy.view'), async (_req: Request, res: Response) => {
  try {
    const treaties = await prisma.diplomaticTreaty.findMany({
      orderBy: { signed_at: 'desc' },
      include: {
        state: { select: { id: true, name: true } },
      },
    })
    res.json(treaties)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/diplomacy/treaties
router.post('/treaties', requireAuth, requirePermission('diplomacy.manage'), async (req: Request, res: Response) => {
  try {
    const { state_id, type, body } = req.body
    if (!state_id || !type || !body) {
      res.status(400).json({ error: 'state_id, type и body обязательны' })
      return
    }

    const number = await generateTreatyNumber()

    const treaty = await prisma.diplomaticTreaty.create({
      data: {
        number,
        state_id,
        type: type as TreatyType,
        body,
        signed_at: new Date(),
        status: 'ACTIVE',
      },
      include: {
        state: { select: { id: true, name: true } },
      },
    })

    res.status(201).json(treaty)
  } catch (err) {
    console.error(err)
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

// POST /api/diplomacy/treaties/:id/pdf
router.post('/treaties/:id/pdf', requireAuth, requirePermission('diplomacy.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const treaty = await prisma.diplomaticTreaty.findUnique({
      where: { id },
      include: { state: { select: { id: true, name: true } } },
    })
    if (!treaty) {
      res.status(404).json({ error: 'Договор не найден' })
      return
    }

    const pdfBuffer = await renderTreatyPdf(treaty)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="treaty-${treaty.number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

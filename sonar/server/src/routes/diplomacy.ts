import { Router, Request, Response } from 'express'
import { PrismaClient, RelationStatus, TreatyType, TreatyStatus } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern } from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

async function generateTreatyNumber(): Promise<string> {
  const count = await prisma.diplomaticTreaty.count()
  const seq = count + 1
  return `ДПЛ-${String(seq).padStart(3, '0')}`
}


async function renderTreatyPdf(treaty: {
  number: string
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
  const signedDate = treaty.signed_at.toLocaleDateString('ru-RU')
  const guilloche = guillochePattern(treaty.number, 794, 50)
  const bodyHtml = treaty.body
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #FFFFFF; font-family: 'Inter', sans-serif; }

  .header {
    background: #0A1628;
    height: 80px;
    display: flex;
    align-items: center;
    padding: 0 40px;
  }
  .header-left { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 3px; width: 180px; flex-shrink: 0; line-height: 1.6; }
  .header-center { flex: 1; text-align: center; }
  .header-doctype { color: #FFFFFF; font-size: 18px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .header-sub { color: rgba(255,255,255,0.6); font-size: 13px; margin-top: 5px; }
  .header-right { width: 180px; text-align: right; font-size: 12px; color: rgba(255,255,255,0.5); }

  .guilloche-bar { overflow: hidden; height: 50px; background: #F8F9FB; border-bottom: 1px solid #E5E7EB; }

  .parties-banner {
    background: #F0F4FA;
    border-bottom: 1px solid #D0D7E3;
    padding: 16px 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    font-size: 14px;
    font-weight: 600;
    color: #0A1628;
  }
  .party-arrow { color: #4A90D9; font-size: 18px; }

  .content { padding: 32px 40px 28px; }
  .doc-number { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #4A90D9; letter-spacing: 0.06em; margin-bottom: 6px; }
  .doc-type-title { font-size: 18px; font-weight: 700; color: #0A1628; margin-bottom: 24px; }
  .doc-body p { font-size: 14px; color: #374151; line-height: 1.8; margin-bottom: 8px; }

  .footer {
    border-top: 1px solid #E5E7EB;
    background: #F8F9FB;
    padding: 20px 40px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .sig-block { }
  .sig-line { border-bottom: 1px solid #6B7280; height: 28px; margin-bottom: 6px; }
  .sig-label { font-size: 11px; color: #6B7280; font-style: italic; }
  .sig-party { font-size: 12px; color: #374151; font-weight: 500; margin-bottom: 4px; }
  .date-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
  .date-value { font-size: 13px; color: #374151; font-weight: 500; }
  .doc-footer-strip {
    padding: 10px 40px;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #C4C9D4;
    border-top: 1px solid #F0F2F5;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
    <div class="header-center">
      <div class="header-doctype">Дипломатический договор</div>
      <div class="header-sub">№${treaty.number}</div>
    </div>
    <div class="header-right">${signedDate}</div>
  </div>
  <div class="guilloche-bar">${guilloche}</div>

  <div class="parties-banner">
    <span>Государство Пельагрия</span>
    <span class="party-arrow">⟺</span>
    <span>${treaty.state?.name ?? 'Неизвестное государство'}</span>
  </div>

  <div class="content">
    <div class="doc-number">Договор №${treaty.number}</div>
    <div class="doc-type-title">${typeLabel}</div>
    <div class="doc-body">${bodyHtml}</div>
  </div>

  <div class="footer">
    <div class="sig-block">
      <div class="sig-party">Государство Пельагрия</div>
      <div class="sig-line"></div>
      <div class="sig-label">Глава государства</div>
      <div style="margin-top:12px;">
        <div class="date-label">Дата подписания</div>
        <div class="date-value">${signedDate}</div>
      </div>
    </div>
    <div class="sig-block">
      <div class="sig-party">${treaty.state?.name ?? '—'}</div>
      <div class="sig-line"></div>
      <div class="sig-label">Уполномоченный представитель</div>
    </div>
  </div>
  <div class="doc-footer-strip">
    <span>Государственная информационная система СОНАР</span>
    <span>Дата печати: ${new Date().toLocaleDateString('ru-RU')}</span>
  </div>
</body>
</html>`

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

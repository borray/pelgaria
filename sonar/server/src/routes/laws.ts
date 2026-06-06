import { Router, Request, Response } from 'express'
import { PrismaClient, LawType, LawStatus, Prisma } from '@prisma/client'
import puppeteer from 'puppeteer-core'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

async function generateLawNumber(type: LawType): Promise<string> {
  const prefix = type === 'LAW' ? 'ЗАК' : 'УКЗ'
  const count = await prisma.law.count({ where: { type } })
  const seq = count + 1
  return `${prefix}-${String(seq).padStart(3, '0')}`
}

function generateGuilloché(seed: string): string {
  const chars = seed.split('').map((c) => c.charCodeAt(0))
  const lines: string[] = []
  for (let i = 0; i < 6; i++) {
    const amp = 6 + (chars[i % chars.length] % 8)
    const freq = 0.015 + (chars[(i + 1) % chars.length] % 10) * 0.003
    const phase = (chars[(i + 2) % chars.length] % 10) * 0.5
    const yBase = 8 + i * 14
    const pts: string[] = []
    for (let x = 0; x <= 700; x += 5) {
      const y = yBase + amp * Math.sin(freq * x + phase)
      pts.push(`${x},${y.toFixed(2)}`)
    }
    lines.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#1B3A6B" stroke-width="0.8" opacity="0.15"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="96">${lines.join('')}</svg>`
}

async function renderLawPdf(law: {
  number: string
  type: LawType
  title: string
  body: string
  status: LawStatus
  adopted_at: Date
  repealed_at: Date | null
}): Promise<Buffer> {
  const guilloché = generateGuilloché(law.number)
  const typeLabel = law.type === 'LAW' ? 'ЗАКОН' : 'УКАЗ'
  const docTitle = `${typeLabel} №${law.number}`
  const adoptedDate = law.adopted_at.toLocaleDateString('ru-RU')

  const bodyHtml = law.body
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
  body { background: #F2F4F7; font-family: 'Inter', sans-serif; padding: 32px; }
  .card { background: #FFFFFF; max-width: 640px; margin: 0 auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
  .header { background: #0A1628; padding: 28px 36px 24px; }
  .header-state { color: rgba(255,255,255,0.5); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
  .header-doctype { color: #FFFFFF; font-size: 22px; font-weight: 700; letter-spacing: 0.04em; }
  .guilloché { background: #F8F9FB; overflow: hidden; height: 96px; }
  .body-section { padding: 28px 36px; }
  .doc-title { font-size: 18px; font-weight: 700; color: #0A1628; margin-bottom: 20px; line-height: 1.4; }
  .doc-body p { font-size: 14px; color: #374151; line-height: 1.7; margin-bottom: 8px; }
  .footer { border-top: 1px solid #E5E7EB; padding: 20px 36px; display: flex; justify-content: space-between; align-items: flex-end; background: #F8F9FB; }
  .date-label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .date-value { font-size: 14px; color: #374151; font-weight: 500; }
  .signature { font-size: 12px; color: #6B7280; font-style: italic; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="header-state">Государство Пельагрия</div>
    <div class="header-doctype">${docTitle}</div>
  </div>
  <div class="guilloché">${guilloché}</div>
  <div class="body-section">
    <div class="doc-title">${law.title}</div>
    <div class="doc-body">${bodyHtml}</div>
  </div>
  <div class="footer">
    <div>
      <div class="date-label">Дата принятия</div>
      <div class="date-value">${adoptedDate}</div>
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
      ]
    }

    const laws = await prisma.law.findMany({
      where,
      orderBy: { adopted_at: 'desc' },
    })
    res.json(laws)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/laws
router.post('/', requireAuth, requirePermission('laws.create'), async (req: Request, res: Response) => {
  try {
    const { type, title, body } = req.body
    if (!type || !title || !body) {
      res.status(400).json({ error: 'type, title и body обязательны' })
      return
    }

    const number = await generateLawNumber(type as LawType)

    const law = await prisma.law.create({
      data: {
        number,
        type: type as LawType,
        title,
        body,
        status: 'ACTIVE',
        adopted_at: new Date(),
      },
    })

    res.status(201).json(law)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/laws/:id
router.get('/:id', requireAuth, requirePermission('laws.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const law = await prisma.law.findFirst({
      where: { OR: [{ id }, { number: id }] },
    })
    if (!law) {
      res.status(404).json({ error: 'Закон не найден' })
      return
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
    const law = await prisma.law.findUnique({ where: { id } })
    if (!law) {
      res.status(404).json({ error: 'Закон не найден' })
      return
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

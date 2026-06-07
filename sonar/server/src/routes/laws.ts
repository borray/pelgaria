import { Router, Request, Response } from 'express'
import { PrismaClient, LawType, LawStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern } from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

async function generateLawNumber(type: LawType): Promise<string> {
  const prefix = type === 'LAW' ? 'ЗАК' : 'УКЗ'
  const count = await prisma.law.count({ where: { type } })
  const seq = count + 1
  return `${prefix}-${String(seq).padStart(3, '0')}`
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
  const typeLabel = law.type === 'LAW' ? 'ЗАКОН' : 'УКАЗ'
  const docNumber = `${typeLabel} №${law.number}`
  const adoptedDate = law.adopted_at.toLocaleDateString('ru-RU')
  const guilloche = guillochePattern(law.number, 794, 50)

  const statusLabel = law.status === 'ACTIVE' ? 'ДЕЙСТВУЕТ' : law.status === 'REPEALED' ? 'ОТМЕНЁН' : 'ПРИОСТАНОВЛЕН'
  const statusColor = law.status === 'ACTIVE' ? '#16A34A' : law.status === 'REPEALED' ? '#DC2626' : '#D97706'

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
  body { background: #FFFFFF; font-family: 'Inter', sans-serif; }

  .header {
    background: #0A1628;
    height: 80px;
    display: flex;
    align-items: center;
    padding: 0 40px;
  }
  .header-left {
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
    letter-spacing: 3px;
    width: 180px;
    flex-shrink: 0;
    line-height: 1.6;
  }
  .header-center { flex: 1; text-align: center; }
  .header-doctype {
    color: #FFFFFF;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .header-sub {
    color: rgba(255,255,255,0.5);
    font-size: 11px;
    margin-top: 4px;
    letter-spacing: 0.04em;
  }
  .header-right {
    width: 180px;
    text-align: right;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
  }

  .guilloche-bar { overflow: hidden; height: 50px; background: #F8F9FB; border-bottom: 1px solid #E5E7EB; }

  .content { padding: 36px 40px 28px; }
  .doc-number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #4A90D9;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
  }
  .doc-title {
    font-size: 20px;
    font-weight: 700;
    color: #0A1628;
    margin-bottom: 8px;
    line-height: 1.4;
  }
  .doc-status {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${statusColor};
    background: ${statusColor}18;
    border: 1px solid ${statusColor}44;
    border-radius: 3px;
    padding: 2px 8px;
    margin-bottom: 24px;
  }
  .doc-body p {
    font-size: 14px;
    color: #374151;
    line-height: 1.8;
    margin-bottom: 8px;
  }

  .footer {
    border-top: 1px solid #E5E7EB;
    background: #F8F9FB;
    padding: 20px 40px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .date-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .date-value { font-size: 14px; color: #374151; font-weight: 500; }
  .signature-block { text-align: right; }
  .signature-line { width: 160px; border-bottom: 1px solid #6B7280; height: 22px; margin-left: auto; }
  .signature-label { font-size: 11px; color: #6B7280; font-style: italic; margin-top: 4px; }
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
      <div class="header-doctype">${typeLabel}</div>
      <div class="header-sub">НОРМАТИВНЫЙ ПРАВОВОЙ АКТ</div>
    </div>
    <div class="header-right">${adoptedDate}</div>
  </div>
  <div class="guilloche-bar">${guilloche}</div>

  <div class="content">
    <div class="doc-number">${docNumber}</div>
    <div class="doc-title">${law.title}</div>
    <div class="doc-status">${statusLabel}</div>
    <div class="doc-body">${bodyHtml}</div>
  </div>

  <div class="footer">
    <div>
      <div class="date-label">Дата принятия</div>
      <div class="date-value">${adoptedDate}</div>
      ${law.repealed_at ? `<div class="date-label" style="margin-top:8px;">Дата отмены</div><div class="date-value">${law.repealed_at.toLocaleDateString('ru-RU')}</div>` : ''}
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-label">Глава государства</div>
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

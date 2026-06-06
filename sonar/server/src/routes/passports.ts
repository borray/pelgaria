import { Router, Request, Response } from 'express'
import { PrismaClient, PassportStatus } from '@prisma/client'
import crypto from 'crypto'
import puppeteer from 'puppeteer-core'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
const prisma = new PrismaClient()

async function generatePassportNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.passport.count({
    where: { number: { endsWith: `-${year}` } },
  })
  const seq = count + 1
  return `PSP-${String(seq).padStart(4, '0')}-${year}`
}

function generateGuillochesvg(seed: string): string {
  const digits = seed.replace(/\D/g, '').split('').map(Number)
  const lines: string[] = []
  for (let i = 0; i < 8; i++) {
    const amp = 8 + (digits[i % digits.length] ?? 5) * 2
    const freq = 0.02 + (digits[(i + 1) % digits.length] ?? 3) * 0.005
    const phase = (digits[(i + 2) % digits.length] ?? 0) * 0.6
    const yBase = 10 + i * 12
    const points: string[] = []
    for (let x = 0; x <= 600; x += 4) {
      const y = yBase + amp * Math.sin(freq * x + phase)
      points.push(`${x},${y.toFixed(2)}`)
    }
    lines.push(`<polyline points="${points.join(' ')}" fill="none" stroke="#1B3A6B" stroke-width="0.7" opacity="0.15"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="110">${lines.join('')}</svg>`
}

function generateBarcode(data: string): string {
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  const hash8 = hash.slice(0, 8)
  const fullData = `${data}|${hash8}`

  const pattern: number[] = []
  for (let i = 0; i < fullData.length; i++) {
    const code = fullData.charCodeAt(i)
    const widths = [1, 1, 2, 1, 2]
    for (let b = 0; b < 5; b++) {
      pattern.push(widths[b % 5] * (1 + (code >> b) % 2))
    }
  }

  const totalWidth = pattern.reduce((a, b) => a + b, 0)
  const scale = 200 / totalWidth
  let x = 0
  const bars: string[] = []
  pattern.forEach((w, i) => {
    const scaledW = w * scale
    if (i % 2 === 0) {
      bars.push(`<rect x="${x.toFixed(1)}" y="0" width="${scaledW.toFixed(1)}" height="40" fill="#0A1628"/>`)
    }
    x += scaledW
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40">${bars.join('')}</svg>`
}

async function renderPassportPdf(passport: {
  number: string
  issued_at: Date
  expires_at: Date | null
  citizen: {
    nickname: string
    discord_username: string | null
    role_title: string
    reg_number: string
  }
  issued_by: { login: string } | null
}): Promise<Buffer> {
  const guilloché = generateGuillochesvg(passport.number)
  const barcodeData = `${passport.number}|${passport.citizen.nickname}|${passport.issued_at.toISOString().slice(0, 10)}`
  const barcode = generateBarcode(barcodeData)

  const issuedDate = passport.issued_at.toLocaleDateString('ru-RU')
  const expiresDate = passport.expires_at
    ? passport.expires_at.toLocaleDateString('ru-RU')
    : 'Бессрочно'

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #F2F4F7; font-family: 'Inter', sans-serif; padding: 32px; }
  .card {
    width: 560px;
    background: #FFFFFF;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  }
  .header {
    background: #0A1628;
    padding: 24px 32px 20px;
    position: relative;
  }
  .header-title {
    color: #FFFFFF;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .header-sub {
    color: rgba(255,255,255,0.5);
    font-size: 12px;
    margin-top: 4px;
    letter-spacing: 0.03em;
  }
  .heraldry {
    width: 60px; height: 60px;
    border: 1.5px dashed rgba(255,255,255,0.3);
    border-radius: 4px;
    position: absolute;
    right: 32px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .heraldry-text {
    color: rgba(255,255,255,0.2);
    font-size: 9px;
    text-align: center;
    font-family: 'Inter', sans-serif;
  }
  .guilloché {
    overflow: hidden;
    height: 110px;
    background: #F8F9FB;
  }
  .passport-number-section {
    padding: 20px 32px 16px;
    border-bottom: 1px solid #E5E7EB;
  }
  .passport-number-label {
    font-size: 10px;
    color: #9CA3AF;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
  }
  .passport-number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    color: #0A1628;
    letter-spacing: 0.05em;
  }
  .fields {
    padding: 20px 32px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .field-label {
    font-size: 10px;
    color: #9CA3AF;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 3px;
  }
  .field-value {
    font-size: 14px;
    color: #1F2937;
    font-weight: 500;
  }
  .footer {
    background: #F8F9FB;
    padding: 16px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #E5E7EB;
  }
  .signature-label {
    font-size: 11px;
    color: #6B7280;
    font-style: italic;
  }
  .barcode-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .barcode-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #9CA3AF;
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="header-title">Государство Пельагрия</div>
    <div class="header-sub">Внутренний паспорт гражданина</div>
    <div class="heraldry"><span class="heraldry-text">ГЕРБ</span></div>
  </div>
  <div class="guilloché">${guilloché}</div>
  <div class="passport-number-section">
    <div class="passport-number-label">Номер паспорта</div>
    <div class="passport-number">${passport.number}</div>
  </div>
  <div class="fields">
    <div>
      <div class="field-label">Никнейм</div>
      <div class="field-value">${passport.citizen.nickname}</div>
    </div>
    <div>
      <div class="field-label">Discord</div>
      <div class="field-value">${passport.citizen.discord_username ?? '—'}</div>
    </div>
    <div>
      <div class="field-label">Роль / Звание</div>
      <div class="field-value">${passport.citizen.role_title}</div>
    </div>
    <div>
      <div class="field-label">Рег. номер</div>
      <div class="field-value" style="font-family:'JetBrains Mono',monospace;">${passport.citizen.reg_number}</div>
    </div>
    <div>
      <div class="field-label">Дата выдачи</div>
      <div class="field-value">${issuedDate}</div>
    </div>
    <div>
      <div class="field-label">Действителен до</div>
      <div class="field-value">${expiresDate}</div>
    </div>
  </div>
  <div class="footer">
    <div class="signature-label">Глава государства</div>
    <div class="barcode-wrap">
      ${barcode}
      <div class="barcode-text">${passport.number}</div>
    </div>
  </div>
</div>
</body>
</html>`

  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({
    format: 'A5',
    printBackground: true,
    margin: { top: '16px', bottom: '16px', left: '16px', right: '16px' },
  })
  await browser.close()
  return Buffer.from(pdfBuffer)
}

// GET /api/passports
router.get('/', requireAuth, requirePermission('passports.view'), async (req: Request, res: Response) => {
  try {
    const { citizen_id } = req.query as Record<string, string>
    const where: { citizen_id?: string } = {}
    if (citizen_id) where.citizen_id = citizen_id

    const passports = await prisma.passport.findMany({
      where,
      orderBy: { issued_at: 'desc' },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
      },
    })
    res.json(passports)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/passports
router.post('/', requireAuth, requirePermission('passports.issue'), async (req: Request, res: Response) => {
  try {
    const { citizen_id } = req.body
    if (!citizen_id) {
      res.status(400).json({ error: 'citizen_id обязателен' })
      return
    }

    const citizen = await prisma.citizen.findUnique({ where: { id: citizen_id } })
    if (!citizen) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    const number = await generatePassportNumber()
    const issued_at = new Date()
    const expires_at = new Date(issued_at)
    expires_at.setFullYear(expires_at.getFullYear() + 2)

    const passport = await prisma.passport.create({
      data: {
        number,
        citizen_id,
        issued_at,
        expires_at,
        status: 'VALID',
        previous_numbers: [],
        issued_by_id: req.user!.id,
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
      },
    })

    res.status(201).json(passport)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/passports/:id/reissue
router.post('/:id/reissue', requireAuth, requirePermission('passports.reissue'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const old = await prisma.passport.findUnique({ where: { id } })
    if (!old) {
      res.status(404).json({ error: 'Паспорт не найден' })
      return
    }

    await prisma.passport.update({
      where: { id },
      data: { status: 'REVOKED' },
    })

    const prevNumbers = [...(old.previous_numbers as string[]), old.number]
    const newNumber = await generatePassportNumber()
    const issued_at = new Date()
    const expires_at = new Date(issued_at)
    expires_at.setFullYear(expires_at.getFullYear() + 2)

    const passport = await prisma.passport.create({
      data: {
        number: newNumber,
        citizen_id: old.citizen_id,
        issued_at,
        expires_at,
        status: 'VALID',
        previous_numbers: prevNumbers,
        issued_by_id: req.user!.id,
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
      },
    })

    res.status(201).json(passport)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/passports/:id/revoke
router.post('/:id/revoke', requireAuth, requirePermission('passports.issue'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const existing = await prisma.passport.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Паспорт не найден' })
      return
    }

    const passport = await prisma.passport.update({
      where: { id },
      data: { status: 'REVOKED' as PassportStatus },
    })

    void reason
    res.json(passport)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/passports/:id/pdf
router.get('/:id/pdf', requireAuth, requirePermission('passports.view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const passport = await prisma.passport.findUnique({
      where: { id },
      include: {
        citizen: true,
        issued_by: { select: { id: true, login: true } },
      },
    })

    if (!passport) {
      res.status(404).json({ error: 'Паспорт не найден' })
      return
    }

    const pdfBuffer = await renderPassportPdf(passport as Parameters<typeof renderPassportPdf>[0])

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="passport-${passport.number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

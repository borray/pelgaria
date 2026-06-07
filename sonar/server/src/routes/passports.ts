import { Router, Request, Response } from 'express'
import { PrismaClient, PassportStatus } from '@prisma/client'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern, barcodeStripes } from '../services/templates'

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
  const guilloche = guillochePattern(passport.number, 794, 60)
  const barcodeData = `${passport.number}|${passport.citizen.nickname}|${passport.issued_at.toISOString().slice(0, 10)}`
  const hash8 = crypto.createHash('sha256').update(barcodeData).digest('hex').slice(0, 8)
  const barcode = barcodeStripes(`${barcodeData}|${hash8}`, 260, 44)

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
  .header-center {
    flex: 1;
    text-align: center;
  }
  .header-title {
    color: #FFFFFF;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .header-sub {
    color: rgba(255,255,255,0.5);
    font-size: 11px;
    margin-top: 3px;
    letter-spacing: 0.04em;
  }
  .header-right {
    width: 180px;
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
  }
  .heraldry {
    width: 52px; height: 52px;
    border: 1.5px dashed rgba(255,255,255,0.3);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: rgba(255,255,255,0.2);
    text-align: center;
  }

  .guilloche-bar {
    overflow: hidden;
    height: 60px;
    background: #F8F9FB;
    border-bottom: 1px solid #E5E7EB;
  }

  .passport-number-row {
    padding: 22px 40px 18px;
    border-bottom: 1px solid #E5E7EB;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
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
    font-size: 30px;
    font-weight: 700;
    color: #0A1628;
    letter-spacing: 0.06em;
  }
  .photo-placeholder {
    width: 90px;
    height: 110px;
    border: 1.5px dashed #D0D7E3;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #D0D7E3;
    text-align: center;
    flex-shrink: 0;
    letter-spacing: 0.04em;
  }

  .fields-section {
    padding: 20px 40px;
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
    border-top: 1px solid #E5E7EB;
    background: #F8F9FB;
    padding: 16px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .signature-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .signature-line {
    width: 180px;
    border-bottom: 1px solid #6B7280;
    height: 22px;
  }
  .signature-label {
    font-size: 11px;
    color: #6B7280;
    font-style: italic;
  }
  .barcode-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .barcode-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #9CA3AF;
    letter-spacing: 0.05em;
  }
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
      <div class="header-title">Внутренний паспорт гражданина</div>
      <div class="header-sub">ГОСУДАРСТВЕННАЯ ИНФОРМАЦИОННАЯ СИСТЕМА СОНАР</div>
    </div>
    <div class="header-right">
      <div class="heraldry">ГЕРБ</div>
    </div>
  </div>

  <div class="guilloche-bar">${guilloche}</div>

  <div class="passport-number-row">
    <div>
      <div class="passport-number-label">Номер паспорта</div>
      <div class="passport-number">${passport.number}</div>
    </div>
    <div class="photo-placeholder">МЕСТО<br>ДЛЯ<br>ФОТО</div>
  </div>

  <div class="fields-section">
    <div>
      <div class="field-label">Никнейм</div>
      <div class="field-value">${passport.citizen.nickname}</div>
    </div>
    <div>
      <div class="field-label">Discord</div>
      <div class="field-value">${passport.citizen.discord_username ?? '—'}</div>
    </div>
    <div>
      <div class="field-label">Роль в государстве</div>
      <div class="field-value">${passport.citizen.role_title}</div>
    </div>
    <div>
      <div class="field-label">Рег. номер</div>
      <div class="field-value" style="font-family:'JetBrains Mono',monospace;color:#1B3A6B;">${passport.citizen.reg_number}</div>
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
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-label">Глава государства</div>
    </div>
    <div class="barcode-block">
      ${barcode}
      <div class="barcode-text">${passport.number}</div>
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
    const id = req.params.id as string

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
    const id = req.params.id as string
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
    const id = req.params.id as string

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

    const pdfBuffer = await renderPassportPdf(passport as unknown as Parameters<typeof renderPassportPdf>[0])

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

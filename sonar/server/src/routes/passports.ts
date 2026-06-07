import { Router, Request, Response } from 'express'
import { PrismaClient, PassportStatus } from '@prisma/client'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import {
  barcodeStripes,
  guillocheRosette,
  mrzLines,
  sealBlock,
  pageShell,
  parseOptionalDate,
  ACCENT,
  INK,
} from '../services/templates'

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
  const seed = passport.number
  const barcodeData = `${passport.number}|${passport.citizen.nickname}|${passport.issued_at.toISOString().slice(0, 10)}`
  const hash8 = crypto.createHash('sha256').update(barcodeData).digest('hex').slice(0, 8)
  const barcode = barcodeStripes(`${barcodeData}|${hash8}`, 320, 40)
  const rosette = guillocheRosette(seed, 150)

  const issuedDate = passport.issued_at.toLocaleDateString('ru-RU')
  const expiresDate = passport.expires_at
    ? passport.expires_at.toLocaleDateString('ru-RU')
    : 'Бессрочно'

  const mrz = mrzLines({
    type: 'P',
    country: 'PLG',
    surname: passport.citizen.nickname,
    number: passport.number,
    issued: passport.issued_at.toISOString().slice(0, 10).replace(/-/g, ''),
    expires: passport.expires_at
      ? passport.expires_at.toISOString().slice(0, 10).replace(/-/g, '')
      : '0000',
    reg: passport.citizen.reg_number,
  })

  const signer = passport.issued_by?.login ?? 'СОНАР'
  const seal = sealBlock({ number: passport.number, signer, role: 'Глава государства', date: issuedDate, size: 130 })

  const field = (label: string, value: string, mono = false) =>
    `<div class="pp-field"><div class="pp-label">${label}</div><div class="pp-value"${mono ? ' style="font-family:\'JetBrains Mono\',monospace;color:#1B3A6B;"' : ''}>${value}</div></div>`

  const header = `<div class="pp-header">
    <div class="pp-rosette">${rosette}</div>
    <div class="pp-head-text">
      <div class="pp-state">ГОСУДАРСТВО ПЕЛЬАГРИЯ</div>
      <div class="pp-title">ВНУТРЕННИЙ ПАСПОРТ</div>
      <div class="pp-sub">ГОСУДАРСТВЕННАЯ ИНФОРМАЦИОННАЯ СИСТЕМА СОНАР</div>
    </div>
    <div class="pp-photo">МЕСТО<br>ДЛЯ<br>ФОТО</div>
  </div>`

  const body = `
    <div class="pp-numberbar">
      <div><div class="pp-label">НОМЕР ПАСПОРТА / PASSPORT №</div><div class="pp-number">${passport.number}</div></div>
      <div class="pp-emblem">⬢</div>
    </div>
    <div class="pp-grid">
      ${field('Никнейм / SURNAME', passport.citizen.nickname)}
      ${field('Discord', passport.citizen.discord_username ?? '—')}
      ${field('Роль в государстве', passport.citizen.role_title)}
      ${field('Рег. номер', passport.citizen.reg_number, true)}
      ${field('Дата выдачи', issuedDate)}
      ${field('Действителен до', expiresDate)}
    </div>
    <div class="pp-seal-row">${seal}</div>
  `

  const footer = `
    <div class="pp-mrz">${mrz.split('\n').map((l) => `<div>${l}</div>`).join('')}</div>
    <div class="pp-foot">
      <div class="pp-barcode">${barcode}<div class="pp-barcode-text">${passport.number}</div></div>
      <div class="pp-foot-strip">Документ действителен при наличии электронной подписи СОНАР · Дата печати: ${new Date().toLocaleDateString('ru-RU')}</div>
    </div>
  `

  const styles = `
    .pp-header { display:flex; align-items:center; gap:18px; background:${INK}; color:#fff; padding:16px 22px; border-radius:3px; }
    .pp-rosette { width:74px; height:74px; flex-shrink:0; filter:invert(1) opacity(0.85); }
    .pp-rosette svg { width:74px; height:74px; }
    .pp-head-text { flex:1; text-align:center; }
    .pp-state { font-size:11px; letter-spacing:3px; color:rgba(255,255,255,0.65); }
    .pp-title { font-size:24px; font-weight:700; letter-spacing:0.12em; margin-top:4px; }
    .pp-sub { font-size:10px; color:rgba(255,255,255,0.5); margin-top:5px; letter-spacing:0.05em; }
    .pp-photo { width:78px; height:96px; border:1.5px dashed rgba(255,255,255,0.4); border-radius:3px; display:flex; align-items:center; justify-content:center; font-size:9px; color:rgba(255,255,255,0.5); text-align:center; flex-shrink:0; }
    .pp-numberbar { display:flex; align-items:flex-end; justify-content:space-between; padding:24px 4px 18px; border-bottom:2px solid ${ACCENT}33; }
    .pp-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
    .pp-number { font-family:'JetBrains Mono',monospace; font-size:34px; font-weight:700; color:${INK}; letter-spacing:0.06em; }
    .pp-emblem { font-size:40px; color:${ACCENT}55; }
    .pp-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px 28px; padding:26px 4px; }
    .pp-value { font-size:15px; color:#1F2937; font-weight:500; }
    .pp-seal-row { display:flex; justify-content:flex-end; padding:8px 10px 0; }
    .pp-mrz { font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:700; letter-spacing:2px; background:#F4F6FA; border-top:2px solid ${INK}; border-bottom:1px solid #D0D7E3; padding:12px 14px; color:${INK}; line-height:1.5; overflow:hidden; white-space:nowrap; }
    .pp-foot { display:flex; align-items:flex-end; justify-content:space-between; padding-top:14px; }
    .pp-barcode { display:flex; flex-direction:column; gap:4px; }
    .pp-barcode-text { font-family:'JetBrains Mono',monospace; font-size:9px; color:#9CA3AF; letter-spacing:0.06em; }
    .pp-foot-strip { font-size:9px; color:#9CA3AF; text-align:right; max-width:300px; line-height:1.5; }
  `

  const watermark = `<div style="width:520px;height:520px;">${guillocheRosette(seed + ':wm', 520)}</div>`

  const html = pageShell({
    seed,
    accent: ACCENT,
    header,
    body,
    footer,
    styles,
    watermark,
    kind: 'passport',
  })

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

    let issued_at: Date
    let expires_at: Date | null
    try {
      issued_at = parseOptionalDate(req.body.issued_at) ?? new Date()
      const parsedExpires = parseOptionalDate(req.body.expires_at)
      if (parsedExpires !== null) {
        expires_at = parsedExpires
      } else {
        expires_at = new Date(issued_at)
        expires_at.setFullYear(expires_at.getFullYear() + 2)
      }
    } catch {
      res.status(400).json({ error: 'Некорректная дата' })
      return
    }

    const number = await generatePassportNumber()

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

// PATCH /api/passports/:id — edit issue / expiry dates
router.patch('/:id', requireAuth, requirePermission('passports.issue'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const existing = await prisma.passport.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Паспорт не найден' })
      return
    }

    const data: { issued_at?: Date; expires_at?: Date | null } = {}
    try {
      if (req.body.issued_at !== undefined) {
        const d = parseOptionalDate(req.body.issued_at)
        if (d === null) {
          res.status(400).json({ error: 'issued_at не может быть пустым' })
          return
        }
        data.issued_at = d
      }
      if (req.body.expires_at !== undefined) {
        data.expires_at = parseOptionalDate(req.body.expires_at)
      }
    } catch {
      res.status(400).json({ error: 'Некорректная дата' })
      return
    }

    const passport = await prisma.passport.update({
      where: { id },
      data,
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
      },
    })

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

import { Router, Request, Response } from 'express'
import { PrismaClient, PassportStatus, Prisma } from '@prisma/client'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { nextDocumentNumber, registryCode } from '../services/documentRegistry'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import {
  barcodeStripes,
  escapeHtml,
  guillocheRosette,
  guillocheField,
  microtextLine,
  qrCode,
  mrzLines,
  sealBlock,
  pageShell,
  parseOptionalDate,
  A4_W,
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
  registry_code?: string | null
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
  const barcodeData = passport.registry_code ?? `${passport.number}|${passport.citizen.nickname}|${passport.issued_at.toISOString().slice(0, 10)}`
  const hash8 = crypto.createHash('sha256').update(barcodeData).digest('hex').slice(0, 8)
  const barcode = barcodeStripes(`${barcodeData}|${hash8}`, 300, 46)
  const qr = qrCode(`СОНАР|ПАСПОРТ|${passport.registry_code ?? passport.number}|${passport.citizen.nickname}`, 96)
  const rosette = guillocheRosette(seed, 84)
  const field = guillocheField(`${seed}:fill`, A4_W - 130, 64, 0.14)
  const micro = microtextLine('ПЕЛЬГРАД · СОНАР · ВНУТРЕННИЙ ПАСПОРТ · ' + (passport.registry_code ?? passport.number), A4_W - 130)

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
  const seal = sealBlock({ number: passport.number, signer, role: 'Председатель Верховного Совета', date: issuedDate, size: 116 })

  // Реперные (регистрационные) чёрные квадраты по углам — для точной ЧБ-печати
  const regSquare = (cls: string) => `<div class="pp-reg ${cls}"></div>`

  const fieldRow = (label: string, value: string, mono = false) =>
    `<div class="pp-field"><div class="pp-flabel">${escapeHtml(label)}</div><div class="pp-fvalue${mono ? ' mono' : ''}">${escapeHtml(value)}</div></div>`

  const header = `<div class="pp-header">
    <div class="pp-rosette ink">${rosette}</div>
    <div class="pp-head-text">
      <div class="pp-state">ГОСУДАРСТВО ПЕЛЬГРАД</div>
      <div class="pp-title">ВНУТРЕННИЙ ПАСПОРТ</div>
      <div class="pp-sub">Государственная информационная система СОНАР · мир Пельгария</div>
    </div>
    <div class="pp-photo"><span>М.Ф.</span><small>место<br>для фото</small></div>
  </div>`

  const body = `
    <div class="pp-numberbar">
      <div>
        <div class="pp-label">Номер паспорта · PASSPORT №</div>
        <div class="pp-number">${escapeHtml(passport.number)}</div>
        <div class="pp-registry">${escapeHtml(passport.registry_code ?? '—')}</div>
      </div>
      <div class="pp-qr bc">${qr}</div>
    </div>
    <div class="pp-fieldwrap">
      <div class="pp-fill ink">${field}</div>
      <div class="pp-grid">
        ${fieldRow('Никнейм · SURNAME', passport.citizen.nickname)}
        ${fieldRow('Discord', passport.citizen.discord_username ?? '—')}
        ${fieldRow('Статус / роль', passport.citizen.role_title)}
        ${fieldRow('Рег. номер', passport.citizen.reg_number, true)}
        ${fieldRow('Дата выдачи', issuedDate)}
        ${fieldRow('Действителен до', expiresDate)}
      </div>
    </div>
    <div class="pp-micro ink">${micro}</div>
    <div class="pp-seal-row">${seal}</div>
  `

  const footer = `
    <div class="pp-mrz">${mrz.split('\n').map((l) => `<div>${escapeHtml(l)}</div>`).join('')}</div>
    <div class="pp-foot">
      <div class="pp-barcode bc">${barcode}<div class="pp-barcode-text">${escapeHtml(passport.registry_code ?? passport.number)}</div></div>
      <div class="pp-foot-strip">Документ действителен при наличии электронной подписи СОНАР.<br>Дата печати: ${new Date().toLocaleDateString('ru-RU')}</div>
    </div>
  `

  const styles = `
    /* Паспорт — оптимизирован под чёткую ЧБ-печать на лазерном принтере (Pantum):
       только чёрная линия/контур, без тяжёлых сплошных заливок, гильоши/ШК/QR
       в высоком контрасте grayscale, реперные метки и микротекст. */
    .pp-reg { position:absolute; width:14px; height:14px; background:#000; z-index:6; }
    .pp-reg.tl{ top:0; left:0; } .pp-reg.tr{ top:0; right:0; } .pp-reg.bl{ bottom:0; left:0; } .pp-reg.br{ bottom:0; right:0; }
    .ink svg { filter:grayscale(1) contrast(1.5); }
    .bc svg { filter:grayscale(1) contrast(2); shape-rendering:crispEdges; }
    .pp-header { display:flex; align-items:center; gap:18px; border:2px solid #000; padding:14px 20px; }
    .pp-rosette { width:64px; height:64px; flex-shrink:0; } .pp-rosette svg { width:64px; height:64px; }
    .pp-head-text { flex:1; text-align:center; }
    .pp-state { font-size:11px; letter-spacing:4px; font-weight:700; color:#000; }
    .pp-title { font-family:'PT Serif',serif; font-size:25px; font-weight:700; letter-spacing:0.1em; margin-top:5px; color:#000; }
    .pp-sub { font-size:9.5px; color:#333; margin-top:5px; letter-spacing:0.04em; }
    .pp-photo { width:78px; height:96px; border:2px solid #000; flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; }
    .pp-photo span { font:700 12px 'JetBrains Mono',monospace; letter-spacing:1px; } .pp-photo small { font-size:8px; color:#444; text-align:center; line-height:1.3; }
    .pp-numberbar { display:flex; align-items:center; justify-content:space-between; padding:18px 2px 14px; border-bottom:2px solid #000; }
    .pp-label { font-size:9px; color:#333; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
    .pp-number { font-family:'JetBrains Mono',monospace; font-size:32px; font-weight:700; color:#000; letter-spacing:0.07em; }
    .pp-registry { font-family:'JetBrains Mono',monospace; font-size:11px; margin-top:5px; letter-spacing:.05em; color:#222; }
    .pp-qr { width:84px; height:84px; } .pp-qr svg { width:84px; height:84px; }
    .pp-fieldwrap { position:relative; }
    .pp-fill { position:absolute; inset:0; z-index:0; opacity:.85; pointer-events:none; } .pp-fill svg { width:100%; }
    .pp-grid { position:relative; z-index:1; display:grid; grid-template-columns:1fr 1fr; gap:14px 30px; padding:20px 2px; }
    .pp-field { border-bottom:1px solid #000; padding-bottom:6px; }
    .pp-flabel { font-size:8.5px; color:#333; text-transform:uppercase; letter-spacing:0.08em; }
    .pp-fvalue { font-size:15px; color:#000; font-weight:600; margin-top:4px; }
    .pp-fvalue.mono { font-family:'JetBrains Mono',monospace; font-size:14px; }
    .pp-micro { height:11px; overflow:hidden; margin:6px 0 2px; opacity:.8; } .pp-micro svg { width:100%; }
    .pp-seal-row { display:flex; justify-content:flex-end; padding:6px 8px 0; }
    .pp-mrz { font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:700; letter-spacing:2px; border-top:2px solid #000; border-bottom:2px solid #000; padding:11px 12px; color:#000; line-height:1.5; overflow:hidden; white-space:nowrap; }
    .pp-foot { display:flex; align-items:flex-end; justify-content:space-between; padding-top:14px; }
    .pp-barcode { display:flex; flex-direction:column; gap:4px; }
    .pp-barcode-text { font-family:'JetBrains Mono',monospace; font-size:9px; color:#222; letter-spacing:0.06em; }
    .pp-foot-strip { font-size:9px; color:#333; text-align:right; max-width:300px; line-height:1.55; }
    @media print {
      * { color:#000 !important; }
      .ink svg { filter:grayscale(1) contrast(1.7) !important; }
      .bc svg { filter:grayscale(1) contrast(2.2) !important; shape-rendering:crispEdges; }
      .pp-reg { background:#000 !important; }
    }
  `

  const watermark = `<div style="width:480px;height:480px;">${guillocheRosette(seed + ':wm', 480)}</div>`

  const html = pageShell({
    seed,
    accent: INK,
    header: `${regSquare('tl')}${regSquare('tr')}${regSquare('bl')}${regSquare('br')}${header}`,
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
    const { citizen_id, status, search } = req.query as Record<string, string>
    const where: Prisma.PassportWhereInput = {}
    if (citizen_id) where.citizen_id = citizen_id
    if (status) where.status = status as PassportStatus
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { registry_code: { contains: search, mode: 'insensitive' } },
        { citizen: { nickname: { contains: search, mode: 'insensitive' } } },
        { citizen: { reg_number: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const passports = await prisma.passport.findMany({
      where,
      orderBy: { issued_at: 'desc' },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
      },
    })
    const hydrated = await Promise.all(passports.map(async (passport) => {
      if (passport.registry_code) return passport
      return prisma.passport.update({
        where: { id: passport.id },
        data: { registry_code: registryCode('ПСП', passport.number) },
        include: {
          citizen: { select: { id: true, reg_number: true, nickname: true } },
          issued_by: { select: { id: true, login: true } },
        },
      })
    }))
    res.json(hydrated)
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

    const passport = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, 'passport', 'ПСП', issued_at)
      return tx.passport.create({
        data: {
          number,
          registry_code: registryCode('ПСП', number),
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
    const issued_at = new Date()
    const expires_at = new Date(issued_at)
    expires_at.setFullYear(expires_at.getFullYear() + 2)

    const passport = await prisma.$transaction(async (tx) => {
      const newNumber = await nextDocumentNumber(tx, 'passport', 'ПСП', issued_at)
      return tx.passport.create({
        data: {
          number: newNumber,
          registry_code: registryCode('ПСП', newNumber),
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

// DELETE /api/passports/:id — permanent erasure (only REVOKED/EXPIRED)
router.delete('/:id', requireAuth, requirePermission('passports.issue'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.passport.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Паспорт не найден' })
      return
    }
    if (existing.status === 'VALID') {
      res.status(400).json({ error: 'Нельзя удалить действующий паспорт. Сначала отзовите его.' })
      return
    }
    await prisma.passport.delete({ where: { id } })
    res.status(204).end()
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

    res.set(pdfHeaders(pdfBuffer, `passport-${passport.number}.pdf`))
    res.send(pdfBuffer)
  } catch (err) {
    res.status(500).json(pdfError(err, 'passport'))
  }
})

export default router

import { Router, Request, Response } from 'express'
import { Prisma, PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import { nextDocumentNumber, randomDocumentCode, registryCode } from '../services/documentRegistry'
import {
  barcodeStripes,
  guillocheRosette,
  guillocheField,
  guillochePattern,
  microtextLine,
  signatureSeal,
  pageShell,
  sealBlock,
  A4_W,
  ACCENT,
  INK,
} from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

const FORM_TEMPLATES = [
  {
    id: 'CITIZENSHIP_APPLICATION',
    title: 'Заявление о принятии в гражданство',
    description: 'Печатное заявление кандидата с основанием и обязательством соблюдать законы.',
    prefix: 'ЗГР',
    fields: ['applicant_name', 'discord_username', 'basis', 'residence', 'comment'],
  },
  {
    id: 'RESIDENCE_CERTIFICATE',
    title: 'Справка о регистрации и месте проживания',
    description: 'Подтверждение регистрации гражданина и указанного места проживания.',
    prefix: 'СМЖ',
    fields: ['residence', 'purpose'],
  },
  {
    id: 'CITIZEN_EXTRACT',
    title: 'Выписка из реестра граждан',
    description: 'Служебная выписка о статусе, роли и регистрационном номере гражданина.',
    prefix: 'ВГР',
    fields: ['purpose', 'recipient'],
  },
  {
    id: 'TAX_CLEARANCE',
    title: 'Справка о налоговом статусе',
    description: 'Справка для предъявления в государственные органы и ведомства.',
    prefix: 'СНС',
    fields: ['period', 'purpose', 'recipient'],
  },
  {
    id: 'RELICT_EXTRACT',
    title: 'Выписка по объекту РЕЛИКТ',
    description: 'Краткая регистрационная выписка по объекту недвижимости или инфраструктуры.',
    prefix: 'ВРЛ',
    fields: ['building_name', 'building_number', 'purpose'],
  },
] as const

const FIELD_LABELS: Record<string, string> = {
  applicant_name: 'Имя заявителя',
  discord_username: 'Discord',
  basis: 'Основание обращения',
  residence: 'Место проживания',
  comment: 'Дополнительные сведения',
  purpose: 'Цель предоставления',
  recipient: 'Получатель документа',
  period: 'Отчетный период',
  building_name: 'Наименование объекта',
  building_number: 'Номер объекта РЕЛИКТ',
}

function escapeHtml(value: unknown): string {
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Пробный лист проверки печатной станции — насыщен полиграфическими защитными
// элементами: гильоши, ШК, чёрные реперные квадраты по краям, шкалы цвета и
// серого, микротекст, реестровая печать.
// ---------------------------------------------------------------------------
function renderTestSheet(sheet: { number: string; registry_code: string; created_by_login: string; created_at: Date }): string {
  const seed = sheet.registry_code
  const date = sheet.created_at.toLocaleString('ru-RU')
  const barcode = barcodeStripes(sheet.registry_code, 360, 60)
  const barcode2 = barcodeStripes(`${sheet.number}:CTRL`, 220, 38)
  const rosette = guillocheRosette(seed, 230)
  const rosetteSmall = guillocheRosette(`${seed}:emblem`, 120)
  const field = guillocheField(`${seed}:field`, A4_W - 120, 90, 0.5)
  const band = guillochePattern(`${seed}:band`, A4_W - 120, 70)
  const micro = microtextLine('ПЕЛЬАГРИЯ · СОНАР · ПРОБНЫЙ ЛИСТ · КОНТРОЛЬ ПЕЧАТИ', A4_W - 120)
  const seal = signatureSeal({ number: sheet.number, signer: 'СТАНЦИЯ ПЕЧАТИ', role: 'Контроль качества', date, size: 150, rotate: -6 })

  // Реперные (регистрационные) чёрные квадраты по углам и серединам краёв
  const square = (cls: string) => `<div class="reg-square ${cls}"></div>`
  const crosshair = (cls: string) => `<div class="reg-cross ${cls}"><span></span><span></span></div>`

  // Шкала серого 0→100 % (запрошенная плотность — мишень для растрирования лазера)
  const greySteps = Array.from({ length: 11 }, (_, i) => {
    const v = Math.round((i / 10) * 255)
    const pct = i * 10
    return `<div class="ramp-cell" style="background:rgb(${v},${v},${v});color:${i > 5 ? '#000' : '#fff'};">${pct}</div>`
  }).join('')

  // Векторный полутоновый растр (точечный экран) — ключевой тест для ЧБ-лазера.
  // Для каждой плотности радиус точки задаёт долю запечатки в ячейке 8×8.
  const sid = sheet.number.replace(/[^A-Za-z0-9]/g, '')
  const halftoneCell = (pct: number): string => {
    if (pct >= 100) {
      return `<div class="ht-cell"><div class="ht-fill" style="background:#000;"></div><small>100%</small></div>`
    }
    const cell = 8
    const r = Math.min(cell / 2 - 0.2, cell * Math.sqrt(pct / 100 / Math.PI))
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="62" height="40" viewBox="0 0 62 40"><defs><pattern id="ht${pct}_${sid}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><circle cx="${cell / 2}" cy="${cell / 2}" r="${r.toFixed(2)}" fill="#000"/></pattern></defs><rect width="62" height="40" fill="url(#ht${pct}_${sid})"/></svg>`
    return `<div class="ht-cell"><div class="ht-fill">${svg}</div><small>${pct}%</small></div>`
  }
  const halftones = [10, 25, 40, 55, 70, 85, 100].map(halftoneCell).join('')

  // Калибр толщины линий (тонкие линии при 600/1200 dpi)
  const lineGauge = [0.25, 0.5, 0.75, 1, 1.5, 2, 3].map((w) =>
    `<div class="gauge-col"><div class="gauge-bars">${Array.from({ length: 6 }, () => `<i style="height:${w}px;"></i>`).join('')}</div><small>${w}px</small></div>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { background:#fff; font-family:'Inter',sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .sheet { position:relative; width:794px; min-height:1123px; background:#fff; overflow:hidden; }
    /* чёрные реперные квадраты по краям */
    .reg-square { position:absolute; width:22px; height:22px; background:#000; z-index:5; }
    .reg-square.tl { top:14px; left:14px; } .reg-square.tr { top:14px; right:14px; }
    .reg-square.bl { bottom:14px; left:14px; } .reg-square.br { bottom:14px; right:14px; }
    .reg-square.tm { top:14px; left:50%; transform:translateX(-50%); } .reg-square.bm { bottom:14px; left:50%; transform:translateX(-50%); }
    .reg-square.lm { left:14px; top:50%; transform:translateY(-50%); } .reg-square.rm { right:14px; top:50%; transform:translateY(-50%); }
    .reg-cross { position:absolute; width:34px; height:34px; z-index:5; }
    .reg-cross span { position:absolute; background:#000; }
    .reg-cross span:first-child { left:50%; top:0; width:1.2px; height:100%; transform:translateX(-50%); }
    .reg-cross span:last-child { top:50%; left:0; height:1.2px; width:100%; transform:translateY(-50%); }
    .reg-cross.c1 { top:48px; left:48px; } .reg-cross.c2 { top:48px; right:48px; } .reg-cross.c3 { bottom:48px; left:48px; } .reg-cross.c4 { bottom:48px; right:48px; }
    .frame { position:absolute; inset:46px; border:1.4px solid #111; z-index:1; }
    .frame2 { position:absolute; inset:52px; border:0.5px solid #777; z-index:1; }
    .inner { position:relative; z-index:3; padding:70px 60px 60px; }
    .head { display:flex; align-items:center; gap:18px; border-bottom:2px solid #111; padding-bottom:16px; }
    .head .emblem { width:74px; height:74px; flex-shrink:0; } .head .emblem svg { width:74px; height:74px; }
    .head .state { font-size:10px; letter-spacing:3px; font-weight:700; color:#111; }
    .head h1 { font-family:'PT Serif',serif; font-size:26px; font-weight:700; text-transform:uppercase; color:${INK}; margin-top:5px; letter-spacing:.04em; }
    .head .sub { font-size:11px; color:#444; margin-top:4px; letter-spacing:.04em; }
    .head .headnote { display:inline-block; margin-top:6px; padding:2px 8px; border:1px solid #111; border-radius:3px; font-size:8px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#111; }
    .head .meta { margin-left:auto; text-align:right; font-family:'JetBrains Mono',monospace; font-size:11px; color:#222; line-height:1.7; }
    .head .meta b { color:#111; }
    /* всё печатается ЧБ на лазере — переводим цветные элементы в чёткий монохром */
    .ink svg { filter:grayscale(1) contrast(1.45); }
    .bc svg { filter:grayscale(1) contrast(1.8); shape-rendering:crispEdges; }
    .section-title { font-size:9px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#444; margin:22px 0 8px; }
    .rosette-wrap { position:absolute; top:330px; left:50%; transform:translateX(-50%); width:230px; height:230px; opacity:.5; z-index:2; pointer-events:none; }
    .barcode-row { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-top:14px; }
    .barcode-row .code { font-family:'JetBrains Mono',monospace; font-size:10px; color:#222; margin-top:4px; letter-spacing:.05em; }
    .ramp { display:grid; grid-template-columns:repeat(11,1fr); border:1px solid #111; }
    .ramp-cell { height:34px; display:flex; align-items:flex-end; justify-content:center; padding-bottom:3px; font-family:'JetBrains Mono',monospace; font-size:9px; }
    .halftones { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
    .ht-cell { text-align:center; } .ht-fill { height:40px; border:1px solid #111; overflow:hidden; }
    .ht-fill svg { display:block; width:100%; height:100%; } .ht-cell small { font-family:'JetBrains Mono',monospace; font-size:8px; color:#333; }
    .mono-row { display:flex; gap:12px; align-items:stretch; }
    .grad-bar { flex:1; height:42px; border:1px solid #111; background:linear-gradient(90deg,#000 0%,#fff 100%); }
    .grad-bar-label { font-family:'JetBrains Mono',monospace; font-size:8px; color:#333; margin-top:3px; }
    .rev-patch { width:210px; flex:0 0 auto; background:#000; display:flex; align-items:center; justify-content:center; padding:8px; }
    .rev-patch span { color:#fff; font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:.04em; text-align:center; line-height:1.5; }
    .gauge { display:flex; gap:18px; align-items:flex-end; }
    .gauge-col { text-align:center; } .gauge-bars { display:flex; flex-direction:column; gap:3px; width:60px; }
    .gauge-bars i { display:block; width:100%; background:#000; } .gauge-col small { font-family:'JetBrains Mono',monospace; font-size:8px; color:#444; }
    .band { margin-top:8px; opacity:.85; } .band svg, .field svg, .micro svg { display:block; width:100%; }
    .field { margin-top:8px; opacity:.7; }
    .micro { height:12px; overflow:hidden; margin:14px 0; }
    .footer { display:flex; align-items:flex-end; justify-content:space-between; border-top:2px solid #111; margin-top:22px; padding-top:14px; }
    .footer .note { font-size:10px; color:#555; max-width:430px; line-height:1.55; }
    .footer .note b { color:#111; }
    .seal-wrap { width:150px; height:150px; flex-shrink:0; }
    .destroy-mark { margin-top:14px; text-align:center; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#000; border:1px dashed #000; border-radius:6px; padding:9px; }
    @media print {
      html, body, .sheet { background:#fff !important; }
      * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .ink svg { filter:grayscale(1) contrast(1.6) !important; }
      .bc svg { filter:grayscale(1) contrast(2) !important; shape-rendering:crispEdges; }
      .reg-square, .reg-cross span, .rev-patch { background:#000 !important; }
    }
  </style></head><body>
    <div class="sheet">
      ${square('tl')}${square('tr')}${square('bl')}${square('br')}${square('tm')}${square('bm')}${square('lm')}${square('rm')}
      ${crosshair('c1')}${crosshair('c2')}${crosshair('c3')}${crosshair('c4')}
      <div class="frame"></div><div class="frame2"></div>
      <div class="rosette-wrap ink">${rosette}</div>
      <div class="inner">
        <div class="head">
          <div class="emblem ink">${rosetteSmall}</div>
          <div>
            <div class="state">ГОСУДАРСТВО ПЕЛЬАГРИЯ · СОНАР</div>
            <h1>Пробный лист</h1>
            <div class="sub">Проверка печатной станции и защитных элементов</div>
            <div class="headnote">ЧБ · лазер · оптимизировано для PANTUM M6500W</div>
          </div>
          <div class="meta">№ <b>${escapeHtml(sheet.number)}</b><br>${escapeHtml(sheet.registry_code)}<br>${escapeHtml(date)}<br>Оператор: ${escapeHtml(sheet.created_by_login)}</div>
        </div>

        <div class="section-title">Контрольные штрих-коды</div>
        <div class="barcode-row">
          <div class="bc">${barcode}<div class="code">ОСНОВНОЙ ШК · ${escapeHtml(sheet.registry_code)}</div></div>
          <div class="bc">${barcode2}<div class="code">КОНТРОЛЬ · ${escapeHtml(sheet.number)}</div></div>
        </div>

        <div class="section-title">Шкала плотности (0–100 %)</div>
        <div class="ramp">${greySteps}</div>

        <div class="section-title">Полутоновый растр (точечный экран)</div>
        <div class="halftones">${halftones}</div>

        <div class="section-title">Градиент и реверс (баннинг · заливка тонера)</div>
        <div class="mono-row">
          <div style="flex:1;"><div class="grad-bar"></div><div class="grad-bar-label">ПЛАВНЫЙ ПЕРЕХОД 0→100 % · контроль полос (banding)</div></div>
          <div class="rev-patch"><span>PANTUM M6500W<br>СОНАР · ${escapeHtml(sheet.number)}</span></div>
        </div>

        <div class="section-title">Калибр толщины линий</div>
        <div class="gauge">${lineGauge}</div>

        <div class="section-title">Гильоширный растр и микротекст</div>
        <div class="band ink">${band}</div>
        <div class="micro ink">${micro}</div>
        <div class="field ink">${field}</div>

        <div class="footer">
          <div class="note"><b>Назначение:</b> технологический образец для калибровки печати, совмещения красок и контроля защитных элементов. Юридической силы не имеет. Лист подлежит обязательному уничтожению — запись стирается из мини-базы СОНАР после подтверждения уничтожения.</div>
          <div class="seal-wrap ink">${seal}</div>
        </div>
        <div class="destroy-mark">Образец · уничтожить после проверки · ${escapeHtml(sheet.registry_code)}</div>
      </div>
    </div>
  </body></html>`
}

router.get('/templates', requireAuth, (_req: Request, res: Response) => {
  res.json(FORM_TEMPLATES)
})

// ── Пробные листы проверки печатной станции (отдельная мини-база) ──

// GET /api/print-center/test-sheets — журнал пробных листов
router.get('/test-sheets', requireAuth, async (_req: Request, res: Response) => {
  try {
    const sheets = await prisma.printerTestSheet.findMany({ orderBy: { created_at: 'desc' } })
    res.json(sheets)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось загрузить пробные листы' })
  }
})

// POST /api/print-center/test-sheets — зарегистрировать пробный лист
router.post('/test-sheets', requireAuth, async (req: Request, res: Response) => {
  try {
    const number = randomDocumentCode()
    const sheet = await prisma.printerTestSheet.create({
      data: {
        number,
        registry_code: registryCode('ТЕСТ', number),
        created_by_login: req.user!.login,
        note: typeof req.body?.note === 'string' ? req.body.note.slice(0, 200) : null,
      },
    })
    res.status(201).json(sheet)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось создать пробный лист' })
  }
})

// GET /api/print-center/test-sheets/:id/pdf — печать пробного листа
router.get('/test-sheets/:id/pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const sheet = await prisma.printerTestSheet.findUnique({ where: { id: req.params.id as string } })
    if (!sheet) {
      res.status(404).json({ error: 'Пробный лист не найден' })
      return
    }
    const pdf = await htmlToPdf(renderTestSheet(sheet))
    res.set(pdfHeaders(pdf, `test-${sheet.number}.pdf`))
    res.send(pdf)
  } catch (error) {
    res.status(500).json(pdfError(error, 'printer test sheet'))
  }
})

// DELETE /api/print-center/test-sheets/:id — уничтожение пробного листа
router.delete('/test-sheets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.printerTestSheet.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Пробный лист не найден' })
      return
    }
    await prisma.printerTestSheet.delete({ where: { id } })
    res.status(204).end()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось уничтожить пробный лист' })
  }
})

// GET /api/print-center/templates/:id/blank-pdf — blank form without saving to DB
router.get('/templates/:id/blank-pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const template = FORM_TEMPLATES.find((t) => t.id === req.params.id as string)
    if (!template) {
      res.status(404).json({ error: 'Шаблон не найден' })
      return
    }

    const createdDate = new Date().toLocaleDateString('ru-RU')
    const blankLabel = '___________________________'
    const barcode = barcodeStripes(`BLANK:${template.id}:${Date.now()}`, 320, 42)
    const fields = template.fields
      .map((key) => `<div class="form-row"><div class="form-key">${escapeHtml((FIELD_LABELS as Record<string, string>)[key] ?? key.replace(/_/g, ' '))}</div><div class="form-value">${blankLabel}</div></div>`)
      .join('')
    const subject = `<div class="subject"><strong>${blankLabel}</strong><span>${blankLabel}</span></div>`
    const seal = `<div style="width:118px;height:118px;border:2px dashed #aaa;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#aaa;text-align:center;">МЕСТО<br>ЭЦП</div>`
    const header = `<div class="form-header">
      <div class="form-rosette">${guillocheRosette(`BLANK:${template.id}`, 88)}</div>
      <div><div class="state">ГОСУДАРСТВО ПЕЛЬАГРИЯ · СОНАР</div><div class="title">${escapeHtml(template.title)}</div><div class="number">№ ________________ · ________________</div></div>
    </div>`
    const body = `${subject}<div class="form-fields">${fields || '<div class="blank-lines">________________________________________________________________<br><br>________________________________________________________________<br><br>________________________________________________________________</div>'}</div>
      <div class="declaration">Настоящий документ подлежит заполнению вручную и последующей заверке уполномоченным лицом СОНАР.</div>`
    const footer = `<div class="form-footer"><div>${barcode}<div class="barcode-label">БЛАНК · ${escapeHtml(template.prefix)} · ${createdDate}</div></div>${seal}</div>`
    const styles = `
      .form-header{display:flex;align-items:center;gap:18px;border:2px solid #111;padding:14px 18px}
      .form-rosette{width:72px;height:72px;filter:grayscale(1) contrast(1.6)} .form-rosette svg{width:72px;height:72px}
      .state{font-size:10px;letter-spacing:3px;font-weight:700}.title{font-family:'PT Serif',serif;font-size:22px;font-weight:700;text-transform:uppercase;margin-top:5px}
      .number{font-family:'JetBrains Mono',monospace;font-size:11px;margin-top:5px}.subject{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding:18px 6px 10px;font-size:15px}
      .subject span{font-family:'JetBrains Mono',monospace}.form-fields{margin-top:22px}.form-row{display:grid;grid-template-columns:210px 1fr;border-bottom:1px solid #777;padding:10px 5px}
      .form-key{text-transform:uppercase;font-size:10px;letter-spacing:.06em;color:#444}.form-value{font-size:14px;white-space:pre-wrap}
      .declaration{margin-top:28px;border:1px dashed #555;padding:14px;font-size:11px;line-height:1.6;color:#666}.blank-lines{font-size:14px;line-height:2}
      .form-footer{display:flex;align-items:flex-end;justify-content:space-between;border-top:2px solid #111;padding-top:16px}.barcode-label{font-family:'JetBrains Mono',monospace;font-size:9px;margin-top:4px}
    `
    const html = pageShell({
      seed: `BLANK:${template.id}`,
      kind: 'generated-form',
      accent: INK,
      header,
      body,
      footer,
      styles,
      watermark: `<div style="width:500px;height:500px;opacity:0.5">${guillocheRosette(`${template.id}:blank:wm`, 500)}</div>`,
    })
    const pdf = await htmlToPdf(html)
    res.set(pdfHeaders(pdf, `blank-${template.prefix}.pdf`))
    res.send(pdf)
  } catch (error) {
    res.status(500).json(pdfError(error, 'blank form'))
  }
})

router.get('/documents', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const citizenId = typeof req.query.citizen_id === 'string' ? req.query.citizen_id : undefined
    const documents = await prisma.generatedDocument.findMany({
      where: {
        ...(citizenId ? { citizen_id: citizenId } : {}),
        ...(search ? {
          OR: [
            { number: { contains: search, mode: 'insensitive' } },
            { registry_code: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { citizen: { nickname: { contains: search, mode: 'insensitive' } } },
          ],
        } : {}),
      },
      orderBy: { created_at: 'desc' },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        created_by: { select: { id: true, login: true } },
      },
    })
    res.json(documents)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось загрузить архив печати' })
  }
})

router.post('/documents', requireAuth, async (req: Request, res: Response) => {
  try {
    const template = FORM_TEMPLATES.find((item) => item.id === req.body.template_type)
    if (!template) {
      res.status(400).json({ error: 'Неизвестный тип формы' })
      return
    }
    const citizenId = typeof req.body.citizen_id === 'string' && req.body.citizen_id
      ? req.body.citizen_id
      : null
    if (citizenId) {
      const citizen = await prisma.citizen.findUnique({ where: { id: citizenId } })
      if (!citizen) {
        res.status(404).json({ error: 'Гражданин не найден' })
        return
      }
    }
    const payload = typeof req.body.payload === 'object' && req.body.payload
      ? req.body.payload as Prisma.InputJsonValue
      : {}
    const document = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, `FORM:${template.id}`, template.prefix)
      return tx.generatedDocument.create({
        data: {
          number,
          registry_code: registryCode(template.prefix, number),
          template_type: template.id,
          title: template.title,
          payload,
          citizen_id: citizenId,
          linked_entity_type: req.body.linked_entity_type || (citizenId ? 'CITIZEN' : null),
          linked_entity_id: req.body.linked_entity_id || citizenId,
          created_by_id: req.user!.id,
        },
        include: {
          citizen: { select: { id: true, reg_number: true, nickname: true } },
          created_by: { select: { id: true, login: true } },
        },
      })
    })
    res.status(201).json(document)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось сформировать документ' })
  }
})

router.patch('/documents/:id/attach', requireAuth, async (req: Request, res: Response) => {
  try {
    const document = await prisma.generatedDocument.update({
      where: { id: req.params.id as string },
      data: {
        linked_entity_type: req.body.linked_entity_type || null,
        linked_entity_id: req.body.linked_entity_id || null,
        citizen_id: req.body.linked_entity_type === 'CITIZEN'
          ? req.body.linked_entity_id || null
          : undefined,
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        created_by: { select: { id: true, login: true } },
      },
    })
    res.json(document)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось изменить привязку документа' })
  }
})

router.delete('/documents/:id', requireAuth, requirePermission('accounts.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.generatedDocument.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Документ не найден' })
      return
    }
    await prisma.generatedDocument.delete({ where: { id } })
    res.status(204).end()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось удалить документ' })
  }
})

router.get('/documents/:id/pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: req.params.id as string },
      include: {
        citizen: true,
        created_by: { select: { login: true } },
      },
    })
    if (!document) {
      res.status(404).json({ error: 'Документ не найден' })
      return
    }
    const payload = document.payload as Record<string, unknown>
    const createdDate = document.created_at.toLocaleDateString('ru-RU')
    const barcode = barcodeStripes(document.registry_code, 320, 42)
    const fields = Object.entries(payload)
      .filter(([, value]) => value !== '' && value != null)
      .map(([key, value]) => `<div class="form-row"><div class="form-key">${escapeHtml(FIELD_LABELS[key] ?? key.replace(/_/g, ' '))}</div><div class="form-value">${escapeHtml(value)}</div></div>`)
      .join('')
    const subject = document.citizen
      ? `<div class="subject"><strong>${escapeHtml(document.citizen.nickname)}</strong><span>${escapeHtml(document.citizen.reg_number)}</span></div>`
      : ''
    const signer = document.created_by.login
    const seal = sealBlock({ number: document.number, signer, role: 'Уполномоченное лицо', date: createdDate, size: 118 })
    const header = `<div class="form-header">
      <div class="form-rosette">${guillocheRosette(document.registry_code, 88)}</div>
      <div><div class="state">ГОСУДАРСТВО ПЕЛЬАГРИЯ · СОНАР</div><div class="title">${escapeHtml(document.title)}</div><div class="number">№ ${escapeHtml(document.number)} · ${escapeHtml(document.registry_code)}</div></div>
    </div>`
    const body = `${subject}<div class="form-fields">${fields || '<div class="blank-lines">________________________________________________________________<br><br>________________________________________________________________<br><br>________________________________________________________________</div>'}</div>
      <div class="declaration">Настоящий документ сформирован в государственной информационной системе СОНАР. Сведения внесены в электронный реестр и подтверждаются контрольным ШК.</div>`
    const footer = `<div class="form-footer"><div>${barcode}<div class="barcode-label">${escapeHtml(document.registry_code)}</div></div>${seal}</div>`
    const styles = `
      .form-header{display:flex;align-items:center;gap:18px;border:2px solid #111;padding:14px 18px}
      .form-rosette{width:72px;height:72px;filter:grayscale(1) contrast(1.6)} .form-rosette svg{width:72px;height:72px}
      .state{font-size:10px;letter-spacing:3px;font-weight:700}.title{font-family:'PT Serif',serif;font-size:22px;font-weight:700;text-transform:uppercase;margin-top:5px}
      .number{font-family:'JetBrains Mono',monospace;font-size:11px;margin-top:5px}.subject{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding:18px 6px 10px;font-size:15px}
      .subject span{font-family:'JetBrains Mono',monospace}.form-fields{margin-top:22px}.form-row{display:grid;grid-template-columns:210px 1fr;border-bottom:1px solid #777;padding:10px 5px}
      .form-key{text-transform:uppercase;font-size:10px;letter-spacing:.06em;color:#444}.form-value{font-size:14px;white-space:pre-wrap}
      .declaration{margin-top:28px;border:1px solid #555;padding:14px;font-size:11px;line-height:1.6}.blank-lines{font-size:14px;line-height:2}
      .form-footer{display:flex;align-items:flex-end;justify-content:space-between;border-top:2px solid #111;padding-top:16px}.barcode-label{font-family:'JetBrains Mono',monospace;font-size:9px;margin-top:4px}
    `
    const html = pageShell({
      seed: document.registry_code,
      kind: 'generated-form',
      accent: ACCENT,
      header,
      body,
      footer,
      styles,
      watermark: `<div style="width:500px;height:500px">${guillocheRosette(`${document.registry_code}:wm`, 500)}</div>`,
    })
    const pdf = await htmlToPdf(html)
    res.set(pdfHeaders(pdf, `${document.number}.pdf`))
    res.send(pdf)
  } catch (error) {
    res.status(500).json(pdfError(error, 'print center document'))
  }
})

export default router

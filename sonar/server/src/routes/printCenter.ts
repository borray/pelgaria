import { Router, Request, Response } from 'express'
import { Prisma, PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import { nextDocumentNumber, randomDocumentCode, registryCode } from '../services/documentRegistry'
import {
  barcodeStripes,
  qrCode,
  guillocheRosette,
  guillocheField,
  pageShell,
  sealBlock,
  ACCENT,
  INK,
} from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

const FORM_TEMPLATES = [
  {
    id: 'GENERAL_APPLICATION',
    title: 'Универсальное заявление',
    description: 'Заявление в государственный орган с предметом обращения, просьбой и перечнем приложений.',
    prefix: 'ЗАЯ',
    fields: ['recipient', 'applicant_name', 'request_subject', 'request_text', 'attachments_list', 'contact'],
  },
  {
    id: 'COMPLAINT_FORM',
    title: 'Жалоба',
    description: 'Печатная форма жалобы на решение, действие или бездействие с требованием заявителя.',
    prefix: 'ЖЛБ',
    fields: ['recipient', 'applicant_name', 'complaint_subject', 'circumstances', 'request_text', 'attachments_list', 'contact'],
  },
  {
    id: 'INTERNAL_MEMO',
    title: 'Служебная записка',
    description: 'Внутренний документ для поручений, согласований и передачи сведений между сотрудниками.',
    prefix: 'СЗП',
    fields: ['recipient', 'request_subject', 'request_text', 'deadline', 'attachments_list'],
  },
  {
    id: 'BUILDING_PERMIT',
    title: 'Разрешение на строительство',
    description: 'Разрешительный документ для объекта РЕЛИКТ с владельцем, координатами и условиями работ.',
    prefix: 'РСТ',
    fields: ['applicant_name', 'building_name', 'building_number', 'coordinates', 'work_scope', 'deadline', 'conditions'],
  },
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
  request_subject: 'Предмет обращения',
  request_text: 'Просьба / содержание',
  attachments_list: 'Перечень приложений',
  contact: 'Контакт для ответа',
  complaint_subject: 'Обжалуемое решение или действие',
  circumstances: 'Обстоятельства',
  deadline: 'Срок исполнения',
  coordinates: 'Координаты объекта',
  work_scope: 'Состав работ',
  conditions: 'Особые условия',
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
// Пробный лист проверки печатной станции: крупные машинно-читаемые коды,
// реперные метки, шкалы плотности, растра, линий и мелкого текста.
// ---------------------------------------------------------------------------
export function renderTestSheet(sheet: { number: string; registry_code: string; created_by_login: string; created_at: Date }): string {
  const date = sheet.created_at.toLocaleString('ru-RU')
  const barcode = barcodeStripes(sheet.registry_code, 420, 72)
  const barcode2 = barcodeStripes(`${sheet.number}:CTRL`, 260, 54)
  const qr = qrCode(`СОНАР|ПРОБНЫЙ ЛИСТ|${sheet.registry_code}|${sheet.number}`, 112)

  // Реперные (регистрационные) чёрные квадраты по углам и серединам краёв
  const square = (cls: string) => `<div class="reg-square ${cls}"></div>`
  const crosshair = (cls: string) => `<div class="reg-cross ${cls}"><span></span><span></span></div>`

  // Шкала серого 0→100 % — мишень для проверки плотности и провалов в тенях.
  const greySteps = Array.from({ length: 11 }, (_, i) => {
    const v = Math.round((i / 10) * 255)
    const pct = i * 10
    return `<div class="ramp-cell" style="background:rgb(${v},${v},${v});color:${i > 5 ? '#000' : '#fff'};">${pct}</div>`
  }).join('')

  // Векторный полутоновый растр — ключевой тест для ЧБ-лазера.
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

  // Калибр толщины линий при 600/1200 dpi.
  const lineGauge = [0.25, 0.5, 0.75, 1, 1.5, 2, 3].map((w) =>
    `<div class="gauge-col"><div class="gauge-bars">${Array.from({ length: 6 }, () => `<i style="height:${w}px;"></i>`).join('')}</div><small>${w}px</small></div>`
  ).join('')

  const textGauge = [6, 7, 8, 9, 10].map((size) =>
    `<div style="font-size:${size}px;"><b>${size} px</b> · СОНАР ПЕЛЬГАРИЯ · 0123456789 · ШК ${escapeHtml(sheet.registry_code)}</div>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { background:#fff; font-family:'Inter',sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { size:A4; margin:0; }
    .sheet { position:relative; width:794px; min-height:1123px; background:#fff; overflow:hidden; }
    .reg-square { position:absolute; width:18px; height:18px; background:#000; z-index:5; }
    .reg-square.tl { top:10px; left:10px; } .reg-square.tr { top:10px; right:10px; }
    .reg-square.bl { bottom:10px; left:10px; } .reg-square.br { bottom:10px; right:10px; }
    .reg-square.tm { top:10px; left:50%; transform:translateX(-50%); } .reg-square.bm { bottom:10px; left:50%; transform:translateX(-50%); }
    .reg-square.lm { left:10px; top:50%; transform:translateY(-50%); } .reg-square.rm { right:10px; top:50%; transform:translateY(-50%); }
    .reg-cross { position:absolute; width:34px; height:34px; z-index:5; }
    .reg-cross span { position:absolute; background:#000; }
    .reg-cross span:first-child { left:50%; top:0; width:1.2px; height:100%; transform:translateX(-50%); }
    .reg-cross span:last-child { top:50%; left:0; height:1.2px; width:100%; transform:translateY(-50%); }
    .reg-cross.c1 { top:39px; left:39px; } .reg-cross.c2 { top:39px; right:39px; } .reg-cross.c3 { bottom:39px; left:39px; } .reg-cross.c4 { bottom:39px; right:39px; }
    .frame { position:absolute; inset:35px; border:2px solid #111; z-index:1; }
    .frame2 { position:absolute; inset:41px; border:0.7px solid #777; z-index:1; }
    .inner { position:relative; z-index:3; padding:52px 52px 48px; }
    .head { display:grid; grid-template-columns:1fr auto; align-items:start; gap:18px; border-bottom:3px solid #111; padding-bottom:12px; }
    .head .state { font-size:10px; letter-spacing:3px; font-weight:700; color:#111; }
    .head h1 { font-family:'PT Serif',serif; font-size:25px; font-weight:700; text-transform:uppercase; color:${INK}; margin-top:4px; letter-spacing:.04em; }
    .head .sub { font-size:11px; color:#444; margin-top:4px; letter-spacing:.04em; }
    .head .headnote { display:inline-block; margin-top:6px; padding:3px 8px; border:1px solid #111; font-size:8px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#111; }
    .head .meta { text-align:right; font-family:'JetBrains Mono',monospace; font-size:10px; color:#222; line-height:1.65; }
    .head .meta b { color:#111; }
    .bc svg, .qr svg { filter:grayscale(1) contrast(2.4); shape-rendering:crispEdges; }
    .section-title { font-size:9px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#333; margin:14px 0 6px; }
    .control-grid { display:grid; grid-template-columns:112px minmax(0,1fr); gap:16px; margin-top:12px; padding:12px; border:2px solid #111; }
    .qr, .qr svg { width:112px; height:112px; }
    .barcode-stack { display:flex; flex-direction:column; justify-content:space-between; min-width:0; }
    .barcode-main svg { width:100%; height:72px; }
    .barcode-secondary { display:grid; grid-template-columns:260px 1fr; align-items:end; gap:12px; margin-top:8px; }
    .barcode-secondary svg { width:260px; height:54px; }
    .code { font-family:'JetBrains Mono',monospace; font-size:9px; color:#222; margin-top:3px; letter-spacing:.03em; overflow-wrap:anywhere; }
    .control-note { align-self:center; font-size:9px; line-height:1.5; color:#444; }
    .control-note b { display:block; color:#111; font-size:10px; }
    .ramp { display:grid; grid-template-columns:repeat(11,1fr); border:1px solid #111; }
    .ramp-cell { height:31px; display:flex; align-items:flex-end; justify-content:center; padding-bottom:3px; font-family:'JetBrains Mono',monospace; font-size:8px; }
    .halftones { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
    .ht-cell { text-align:center; } .ht-fill { height:34px; border:1px solid #111; overflow:hidden; }
    .ht-fill svg { display:block; width:100%; height:100%; } .ht-cell small { font-family:'JetBrains Mono',monospace; font-size:8px; color:#333; }
    .mono-row { display:flex; gap:12px; align-items:stretch; }
    .grad-bar { flex:1; height:34px; border:1px solid #111; background:linear-gradient(90deg,#000 0%,#fff 100%); }
    .grad-bar-label { font-family:'JetBrains Mono',monospace; font-size:8px; color:#333; margin-top:3px; }
    .rev-patch { width:185px; flex:0 0 auto; background:#000; display:flex; align-items:center; justify-content:center; padding:6px; }
    .rev-patch span { color:#fff; font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:.04em; text-align:center; line-height:1.5; }
    .diagnostics { display:grid; grid-template-columns:1.25fr .75fr; gap:16px; }
    .gauge { display:flex; justify-content:space-between; gap:8px; align-items:flex-end; padding:9px; border:1px solid #777; }
    .gauge-col { text-align:center; } .gauge-bars { display:flex; flex-direction:column; gap:3px; width:43px; }
    .gauge-bars i { display:block; width:100%; background:#000; } .gauge-col small { font-family:'JetBrains Mono',monospace; font-size:8px; color:#444; }
    .text-gauge { display:flex; flex-direction:column; justify-content:center; gap:5px; padding:9px; border:1px solid #777; font-family:'JetBrains Mono',monospace; line-height:1.2; }
    .alignment { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:7px; }
    .alignment div { position:relative; height:28px; border:1px solid #111; }
    .alignment div::before, .alignment div::after { content:''; position:absolute; background:#111; }
    .alignment div::before { left:50%; top:0; width:1px; height:100%; }
    .alignment div::after { top:50%; left:0; height:1px; width:100%; }
    .alignment span { position:absolute; inset:7px; border:1px solid #777; }
    .footer { display:grid; grid-template-columns:1fr auto; gap:16px; align-items:center; border-top:2px solid #111; margin-top:14px; padding-top:10px; }
    .footer .note { font-size:9px; color:#555; line-height:1.5; }
    .footer .note b { color:#111; }
    .inspection { display:grid; grid-template-columns:repeat(3,72px); gap:5px; }
    .inspection div { height:34px; padding:4px; border:1px solid #111; font-size:7px; text-align:center; text-transform:uppercase; }
    .destroy-mark { margin-top:9px; text-align:center; font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:#000; border:1px dashed #000; padding:7px; }
    @media print {
      html, body, .sheet { background:#fff !important; }
      * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .bc svg, .qr svg { filter:grayscale(1) contrast(2.4) !important; shape-rendering:crispEdges; }
      .reg-square, .reg-cross span, .rev-patch { background:#000 !important; }
    }
  </style></head><body>
    <div class="sheet">
      ${square('tl')}${square('tr')}${square('bl')}${square('br')}${square('tm')}${square('bm')}${square('lm')}${square('rm')}
      ${crosshair('c1')}${crosshair('c2')}${crosshair('c3')}${crosshair('c4')}
      <div class="frame"></div><div class="frame2"></div>
      <div class="inner">
        <div class="head">
          <div>
            <div class="state">ГОСУДАРСТВО ПЕЛЬГАРИЯ · СОНАР</div>
            <h1>Контрольный лист печати</h1>
            <div class="sub">Диагностика штрихкодов, QR, растра, геометрии и читаемости</div>
            <div class="headnote">ЧБ · лазер · PANTUM · 600/1200 DPI</div>
          </div>
          <div class="meta">№ <b>${escapeHtml(sheet.number)}</b><br>${escapeHtml(sheet.registry_code)}<br>${escapeHtml(date)}<br>Оператор: ${escapeHtml(sheet.created_by_login)}</div>
        </div>

        <div class="control-grid">
          <div class="qr">${qr}</div>
          <div class="barcode-stack">
            <div class="bc barcode-main">${barcode}<div class="code">ОСНОВНОЙ CODE 128 · ${escapeHtml(sheet.registry_code)}</div></div>
            <div class="barcode-secondary">
              <div class="bc">${barcode2}<div class="code">КОНТРОЛЬ · ${escapeHtml(sheet.number)}</div></div>
              <div class="control-note"><b>Проверка сканирования</b>QR содержит номер листа и ШК. Все коды векторные и рассчитаны на чёрно-белую печать без масштабирования.</div>
            </div>
          </div>
        </div>

        <div class="section-title">01 · Шкала плотности тонера (0–100 %)</div>
        <div class="ramp">${greySteps}</div>

        <div class="section-title">02 · Полутоновый растр</div>
        <div class="halftones">${halftones}</div>

        <div class="section-title">03 · Градиент и реверс</div>
        <div class="mono-row">
          <div style="flex:1;"><div class="grad-bar"></div><div class="grad-bar-label">ПЛАВНЫЙ ПЕРЕХОД 0→100 % · контроль полос (banding)</div></div>
          <div class="rev-patch"><span>PANTUM M6500W<br>СОНАР · ${escapeHtml(sheet.number)}</span></div>
        </div>

        <div class="section-title">04 · Линии и читаемость мелкого текста</div>
        <div class="diagnostics">
          <div class="gauge">${lineGauge}</div>
          <div class="text-gauge">${textGauge}</div>
        </div>

        <div class="section-title">05 · Геометрия, совмещение и поля</div>
        <div class="alignment">${Array.from({ length: 4 }, () => '<div><span></span></div>').join('')}</div>

        <div class="footer">
          <div class="note"><b>Порядок проверки:</b> печатать в масштабе 100 %, без режима «подогнать». Убедиться, что QR и оба штрихкода считываются, квадраты не обрезаны, линии от 0,5 px различимы, а шкала серого не сливается. Юридической силы не имеет.</div>
          <div class="inspection"><div>Коды<br>читаются</div><div>Поля<br>целы</div><div>Растр<br>ровный</div></div>
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
router.post('/test-sheets', requireAuth, requirePermission('accounts.manage'), async (req: Request, res: Response) => {
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
router.delete('/test-sheets/:id', requireAuth, requirePermission('accounts.manage'), async (req: Request, res: Response) => {
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
      <div><div class="state">ГОСУДАРСТВО ПЕЛЬГАРИЯ · СОНАР</div><div class="title">${escapeHtml(template.title)}</div><div class="number">№ ________________ · ________________</div></div>
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
      <div><div class="state">ГОСУДАРСТВО ПЕЛЬГАРИЯ · СОНАР</div><div class="title">${escapeHtml(document.title)}</div><div class="number">№ ${escapeHtml(document.number)} · ${escapeHtml(document.registry_code)}</div></div>
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

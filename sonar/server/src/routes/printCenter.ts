import { Router, Request, Response } from 'express'
import { Prisma, PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { htmlToPdf } from '../services/pdf'
import { nextDocumentNumber, registryCode } from '../services/documentRegistry'
import {
  barcodeStripes,
  guillocheRosette,
  pageShell,
  sealBlock,
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

router.get('/templates', requireAuth, (_req: Request, res: Response) => {
  res.json(FORM_TEMPLATES)
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
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${document.number}.pdf"`,
      'Content-Length': pdf.length,
    })
    res.send(pdf)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось подготовить PDF' })
  }
})

export default router

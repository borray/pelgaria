import { Router, Request, Response } from 'express'
import { PrismaClient, PunishmentType, PunishmentStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { nextDocumentNumber, registryCode } from '../services/documentRegistry'
import { htmlToPdf } from '../services/pdf'
import {
  guillocheRosette,
  sealBlock,
  pageShell,
  parseOptionalDate,
  ACCENT,
  INK,
} from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

// GET /api/punishments
router.get('/', requireAuth, requirePermission('punishments.view'), async (req: Request, res: Response) => {
  try {
    const { citizen_id, status, type, search } = req.query as Record<string, string>
    const where: Prisma.PunishmentWhereInput = {}
    if (citizen_id) where.citizen_id = citizen_id
    if (status) where.status = status as PunishmentStatus
    if (type) where.type = type as PunishmentType
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { registry_code: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
        { citizen: { nickname: { contains: search, mode: 'insensitive' } } },
        { citizen: { reg_number: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const punishments = await prisma.punishment.findMany({
      where,
      orderBy: { issued_at: 'desc' },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
        revoked_by: { select: { id: true, login: true } },
        case: { select: { id: true, number: true } },
      },
    })
    const hydrated = await Promise.all(punishments.map(async (punishment) => {
      if (punishment.number && punishment.registry_code) return punishment
      const number = punishment.number ?? `ПСТ-${punishment.issued_at.getFullYear()}-${punishment.id.slice(0, 6).toUpperCase()}`
      return prisma.punishment.update({
        where: { id: punishment.id },
        data: {
          number,
          registry_code: punishment.registry_code ?? registryCode('ПСТ', number),
        },
        include: {
          citizen: { select: { id: true, reg_number: true, nickname: true } },
          issued_by: { select: { id: true, login: true } },
          revoked_by: { select: { id: true, login: true } },
          case: { select: { id: true, number: true } },
        },
      })
    }))
    res.json(hydrated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/punishments
router.post('/', requireAuth, requirePermission('punishments.issue'), async (req: Request, res: Response) => {
  try {
    const { citizen_id, type, reason, case_id } = req.body
    if (!citizen_id || !type || !reason) {
      res.status(400).json({ error: 'citizen_id, type и reason обязательны' })
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
      expires_at = parseOptionalDate(req.body.expires_at)
    } catch {
      res.status(400).json({ error: 'Некорректная дата' })
      return
    }

    const punishment = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, 'punishment', 'ПСТ', issued_at)
      return tx.punishment.create({
        data: {
          number,
          registry_code: registryCode('ПСТ', number),
          citizen_id,
          type: type as PunishmentType,
          reason,
          case_id: case_id || null,
          issued_by_id: req.user!.id,
          issued_at,
          expires_at,
          status: 'ACTIVE',
        },
        include: {
          citizen: { select: { id: true, reg_number: true, nickname: true } },
          issued_by: { select: { id: true, login: true } },
        },
      })
    })

    if (type === 'BAN') {
      await prisma.citizen.update({
        where: { id: citizen_id },
        data: { status: 'BANNED' },
      })
    }

    res.status(201).json(punishment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/punishments/:id/revoke
router.post('/:id/revoke', requireAuth, requirePermission('punishments.revoke'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const existing = await prisma.punishment.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Наказание не найдено' })
      return
    }

    if (existing.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Наказание уже неактивно' })
      return
    }

    const punishment = await prisma.punishment.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revoked_by_id: req.user!.id,
        revoked_at: new Date(),
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    if (existing.type === 'BAN') {
      const otherActiveBans = await prisma.punishment.count({
        where: {
          citizen_id: existing.citizen_id,
          type: 'BAN',
          status: 'ACTIVE',
          id: { not: id },
        },
      })

      if (otherActiveBans === 0) {
        await prisma.citizen.update({
          where: { id: existing.citizen_id },
          data: { status: 'ACTIVE' },
        })
      }
    }

    res.json(punishment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/punishments/:id/pdf
router.post('/:id/pdf', requireAuth, requirePermission('punishments.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const punishment = await prisma.punishment.findUnique({
      where: { id },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
        revoked_by: { select: { id: true, login: true } },
        case: { select: { id: true, number: true } },
      },
    })
    if (!punishment) {
      res.status(404).json({ error: 'Наказание не найдено' })
      return
    }

    const seed = punishment.id.slice(0, 12)

    const typeLabels: Record<PunishmentType, string> = {
      BAN: 'Бан',
      WARNING: 'Предупреждение',
      FINE: 'Штраф',
      EXILE: 'Изгнание',
    }
    const statusLabels: Record<PunishmentStatus, string> = {
      ACTIVE: 'АКТИВНО',
      REVOKED: 'ОТОЗВАНО',
      EXPIRED: 'ИСТЕКЛО',
    }
    const statusColors: Record<PunishmentStatus, string> = {
      ACTIVE: '#DC2626',
      REVOKED: '#6B7280',
      EXPIRED: '#D97706',
    }

    const typeLabel = typeLabels[punishment.type] ?? punishment.type
    const statusLabel = statusLabels[punishment.status] ?? punishment.status
    const statusColor = statusColors[punishment.status] ?? '#6B7280'
    const issuedDate = new Date(punishment.issued_at).toLocaleDateString('ru-RU')
    const expiresDate = punishment.expires_at ? new Date(punishment.expires_at).toLocaleDateString('ru-RU') : null
    const revokedDate = punishment.revoked_at ? new Date(punishment.revoked_at).toLocaleDateString('ru-RU') : null

    const signer = punishment.issued_by?.login ?? 'СОНАР'
    const seal = sealBlock({ number: punishment.id.slice(0, 8).toUpperCase(), signer, role: 'Уполномоченное лицо', date: issuedDate, size: 134 })

    const fld = (label: string, value: string, mono = false) =>
      `<div class="pn-field"><div class="pn-label">${label}</div><div class="pn-value"${mono ? ' style="font-family:\'JetBrains Mono\',monospace;color:#1B3A6B;"' : ''}>${value}</div></div>`

    const header = `<div class="pn-header">
      <div class="pn-emblem">${guillocheRosette(seed, 96)}</div>
      <div class="pn-state">ГОСУДАРСТВО ПЕЛЬАГРИЯ</div>
      <div class="pn-doctype">ПОСТАНОВЛЕНИЕ О НАКАЗАНИИ</div>
      <div class="pn-num">№ ${punishment.id.slice(0, 8).toUpperCase()}</div>
    </div>`

    const body = `
      <div class="pn-banner">
        <div class="pn-status"><span class="pn-dot"></span>${statusLabel}</div>
        <div class="pn-type">${typeLabel}</div>
      </div>
      <div class="pn-grid">
        ${fld('Гражданин', punishment.citizen?.nickname ?? '—')}
        ${fld('Рег. номер', punishment.citizen?.reg_number ?? '—', true)}
        ${fld('Тип наказания', typeLabel)}
        ${fld('Назначил', punishment.issued_by?.login ?? '—')}
        ${fld('Дата выдачи', issuedDate)}
        ${expiresDate ? fld('Истекает', expiresDate) : ''}
        ${punishment.case ? fld('Связанное дело', punishment.case.number, true) : ''}
        ${revokedDate ? fld('Отозвано', `${revokedDate} (${punishment.revoked_by?.login ?? '—'})`) : ''}
      </div>
      <div class="pn-section-label">Основание / причина</div>
      <div class="pn-reason">${punishment.reason}</div>
    `

    const footer = `
      <div class="pn-footer">
        <div>
          <div class="pn-label">Документ составлен</div>
          <div class="pn-value">${issuedDate}</div>
        </div>
        <div class="pn-sign">
          ${seal}
          <div class="pn-sign-line"></div>
          <div class="pn-sign-label">Уполномоченное лицо: ${signer}</div>
        </div>
      </div>
      <div class="pn-foot-strip">Государственная информационная система СОНАР · Дата печати: ${new Date().toLocaleDateString('ru-RU')}</div>
    `

    const styles = `
      .pn-header { text-align:center; padding:6px 0 16px; }
      .pn-emblem { width:66px; height:66px; margin:0 auto 8px; }
      .pn-emblem svg { width:66px; height:66px; }
      .pn-state { font-size:11px; letter-spacing:4px; color:${ACCENT}; font-weight:600; }
      .pn-doctype { font-size:24px; font-weight:700; letter-spacing:0.1em; color:${INK}; margin-top:8px; text-transform:uppercase; }
      .pn-num { font-family:'JetBrains Mono',monospace; font-size:13px; color:${ACCENT}; margin-top:6px; }
      .pn-banner { display:flex; align-items:center; gap:16px; border-top:2px solid ${statusColor}66; border-bottom:2px solid ${statusColor}66; background:${statusColor}0D; padding:14px 18px; margin:18px 0 24px; }
      .pn-status { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; letter-spacing:0.08em; color:${statusColor}; text-transform:uppercase; }
      .pn-dot { width:10px; height:10px; border-radius:50%; background:${statusColor}; }
      .pn-type { font-size:15px; font-weight:600; color:${INK}; padding-left:16px; border-left:1px solid #D0D7E3; }
      .pn-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 28px; margin-bottom:24px; }
      .pn-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
      .pn-value { font-size:14px; color:#1F2937; font-weight:500; }
      .pn-section-label { font-size:11px; font-weight:700; color:${INK}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
      .pn-reason { font-size:14px; color:#374151; line-height:1.75; white-space:pre-wrap; background:#F8F9FB; border-left:3px solid ${ACCENT}; padding:16px 20px; border-radius:0 4px 4px 0; }
      .pn-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid ${INK}; padding-top:18px; }
      .pn-sign { text-align:center; }
      .pn-sign-line { width:200px; border-bottom:1px solid #6B7280; height:8px; margin:6px auto 0; }
      .pn-sign-label { font-size:11px; color:#6B7280; font-style:italic; margin-top:5px; }
      .pn-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:12px; }
    `

    const watermark = `<div style="width:500px;height:500px;">${guillocheRosette(seed + ':wm', 500)}</div>`
    const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, watermark, kind: 'punishment' })
    const pdfBuffer = await htmlToPdf(html)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="punishment-${punishment.id.slice(0, 8)}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

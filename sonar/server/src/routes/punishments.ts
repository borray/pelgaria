import { Router, Request, Response } from 'express'
import { PrismaClient, PunishmentType, PunishmentStatus, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern } from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

// GET /api/punishments
router.get('/', requireAuth, requirePermission('punishments.view'), async (req: Request, res: Response) => {
  try {
    const { citizen_id, status, type } = req.query as Record<string, string>
    const where: Prisma.PunishmentWhereInput = {}
    if (citizen_id) where.citizen_id = citizen_id
    if (status) where.status = status as PunishmentStatus
    if (type) where.type = type as PunishmentType

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
    res.json(punishments)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/punishments
router.post('/', requireAuth, requirePermission('punishments.issue'), async (req: Request, res: Response) => {
  try {
    const { citizen_id, type, reason, case_id, expires_at } = req.body
    if (!citizen_id || !type || !reason) {
      res.status(400).json({ error: 'citizen_id, type и reason обязательны' })
      return
    }

    const citizen = await prisma.citizen.findUnique({ where: { id: citizen_id } })
    if (!citizen) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    const punishment = await prisma.punishment.create({
      data: {
        citizen_id,
        type: type as PunishmentType,
        reason,
        case_id: case_id || null,
        issued_by_id: req.user!.id,
        issued_at: new Date(),
        expires_at: expires_at ? new Date(expires_at) : null,
        status: 'ACTIVE',
      },
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        issued_by: { select: { id: true, login: true } },
      },
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

    const guilloche = guillochePattern(id.slice(0, 8), 794, 50)

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

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #FFFFFF; font-family: 'Inter', sans-serif; }
  .header { background: #0A1628; height: 80px; display: flex; align-items: center; padding: 0 40px; }
  .header-left { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 3px; width: 180px; flex-shrink: 0; line-height: 1.6; }
  .header-center { flex: 1; text-align: center; }
  .header-doctype { color: #FFFFFF; font-size: 18px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .header-sub { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 3px; }
  .header-right { width: 180px; text-align: right; font-size: 12px; color: rgba(255,255,255,0.5); }
  .guilloche-bar { overflow: hidden; height: 50px; background: #F8F9FB; border-bottom: 1px solid #E5E7EB; }
  .status-banner {
    background: ${statusColor}0D;
    border-bottom: 2px solid ${statusColor}44;
    padding: 14px 40px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; flex-shrink: 0; }
  .status-text { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: ${statusColor}; text-transform: uppercase; }
  .type-label { font-size: 14px; font-weight: 600; color: #0A1628; }
  .content { padding: 32px 40px 28px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .field-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .field-value { font-size: 14px; color: #1F2937; font-weight: 500; }
  .reason-block { background: #F8F9FB; border-left: 3px solid #4A90D9; padding: 16px 20px; border-radius: 0 4px 4px 0; }
  .reason-text { font-size: 14px; color: #374151; line-height: 1.7; white-space: pre-wrap; }
  .footer { border-top: 1px solid #E5E7EB; background: #F8F9FB; padding: 20px 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig-line { width: 180px; border-bottom: 1px solid #6B7280; height: 24px; }
  .sig-label { font-size: 11px; color: #6B7280; font-style: italic; margin-top: 4px; }
  .doc-footer-strip { padding: 10px 40px; display: flex; justify-content: space-between; font-size: 10px; color: #C4C9D4; border-top: 1px solid #F0F2F5; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
    <div class="header-center">
      <div class="header-doctype">Постановление о наказании</div>
      <div class="header-sub">ГОСУДАРСТВЕННАЯ ИНФОРМАЦИОННАЯ СИСТЕМА СОНАР</div>
    </div>
    <div class="header-right">${issuedDate}</div>
  </div>
  <div class="guilloche-bar">${guilloche}</div>

  <div class="status-banner">
    <div class="status-dot"></div>
    <div class="status-text">${statusLabel}</div>
    <div style="width:1px;height:20px;background:#D0D7E3;margin:0 4px;"></div>
    <div class="type-label">${typeLabel}</div>
  </div>

  <div class="content">
    <div class="fields">
      <div>
        <div class="field-label">Гражданин</div>
        <div class="field-value">${punishment.citizen?.nickname ?? '—'}</div>
      </div>
      <div>
        <div class="field-label">Рег. номер</div>
        <div class="field-value" style="font-family:'JetBrains Mono',monospace;color:#1B3A6B;">${punishment.citizen?.reg_number ?? '—'}</div>
      </div>
      <div>
        <div class="field-label">Тип наказания</div>
        <div class="field-value">${typeLabel}</div>
      </div>
      <div>
        <div class="field-label">Выдал</div>
        <div class="field-value">${punishment.issued_by?.login ?? '—'}</div>
      </div>
      <div>
        <div class="field-label">Дата выдачи</div>
        <div class="field-value">${issuedDate}</div>
      </div>
      ${expiresDate ? `
      <div>
        <div class="field-label">Истекает</div>
        <div class="field-value">${expiresDate}</div>
      </div>` : ''}
      ${punishment.case ? `
      <div>
        <div class="field-label">Дело</div>
        <div class="field-value" style="font-family:'JetBrains Mono',monospace;">${punishment.case.number}</div>
      </div>` : ''}
      ${revokedDate ? `
      <div>
        <div class="field-label">Отозвано</div>
        <div class="field-value">${revokedDate} (${punishment.revoked_by?.login ?? '—'})</div>
      </div>` : ''}
    </div>

    <div class="field-label" style="margin-bottom:8px;">Причина</div>
    <div class="reason-block">
      <div class="reason-text">${punishment.reason}</div>
    </div>
  </div>

  <div class="footer">
    <div>
      <div class="field-label">Документ составлен</div>
      <div style="font-size:13px;color:#374151;font-weight:500;">${issuedDate}</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Уполномоченное лицо: ${punishment.issued_by?.login ?? '—'}</div>
    </div>
  </div>
  <div class="doc-footer-strip">
    <span>Государственная информационная система СОНАР</span>
    <span>Дата печати: ${new Date().toLocaleDateString('ru-RU')}</span>
  </div>
</body>
</html>`

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

import { Router, Request, Response } from 'express'
import { PrismaClient, Prisma, CitizenStatus } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import {
  barcodeStripes,
  guillocheRosette,
  pageShell,
  ACCENT,
  INK,
} from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

async function generateRegNumber(): Promise<string> {
  const count = await prisma.citizen.count()
  const seq = count + 1
  return `ПЕЛ-${String(seq).padStart(4, '0')}`
}

// GET /api/citizens
router.get('/', requireAuth, requirePermission('citizens.view'), async (req: Request, res: Response) => {
  try {
    const { search, status, role } = req.query as Record<string, string>

    const where: Prisma.CitizenWhereInput = {}

    if (search) {
      where.OR = [
        { nickname: { contains: search, mode: 'insensitive' } },
        { discord_username: { contains: search, mode: 'insensitive' } },
        { reg_number: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status as CitizenStatus
    }

    if (role) {
      where.role_title = { contains: role, mode: 'insensitive' }
    }

    const citizens = await prisma.citizen.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: { id: true, login: true, is_active: true },
        },
        _count: {
          select: { passports: true, cases: true, punishments: true },
        },
      },
    })

    res.json(citizens)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/citizens
router.post('/', requireAuth, requirePermission('citizens.create'), async (req: Request, res: Response) => {
  try {
    const { nickname, discord_username, role_title, status, note, joined_at } = req.body

    if (!nickname) {
      res.status(400).json({ error: 'Никнейм обязателен' })
      return
    }

    const reg_number = await generateRegNumber()

    const citizen = await prisma.citizen.create({
      data: {
        reg_number,
        nickname,
        discord_username: discord_username || null,
        role_title: role_title || 'Гражданин',
        status: status || 'ACTIVE',
        note: note || null,
        joined_at: joined_at ? new Date(joined_at) : new Date(),
      },
    })

    res.status(201).json(citizen)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/citizens/:id
router.get('/:id', requireAuth, requirePermission('citizens.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const citizen = await prisma.citizen.findFirst({
      where: {
        OR: [{ id }, { reg_number: id }],
      },
      include: {
        user: {
          select: {
            id: true,
            login: true,
            is_active: true,
            discord_username: true,
            discord_avatar: true,
            last_login_at: true,
          },
        },
        passports: {
          orderBy: { issued_at: 'desc' },
          include: {
            issued_by: { select: { id: true, login: true } },
          },
        },
        cases: {
          orderBy: { opened_at: 'desc' },
          include: {
            law: { select: { id: true, number: true, title: true } },
            judge: { select: { id: true, login: true } },
          },
        },
        punishments: {
          orderBy: { issued_at: 'desc' },
          include: {
            issued_by: { select: { id: true, login: true } },
            revoked_by: { select: { id: true, login: true } },
          },
        },
        tax_charges: {
          orderBy: { period: { starts_at: 'desc' } },
          include: {
            period: true,
            marked_by: { select: { id: true, login: true } },
            building: { select: { id: true, reg_number: true, name: true } },
          },
        },
        buildings: {
          orderBy: { created_at: 'desc' },
        },
      },
    })

    if (!citizen) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    res.json(citizen)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT /api/citizens/:id
router.put('/:id', requireAuth, requirePermission('citizens.edit'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { nickname, discord_username, role_title, status, note, joined_at } = req.body

    const existing = await prisma.citizen.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    const citizen = await prisma.citizen.update({
      where: { id },
      data: {
        nickname: nickname ?? existing.nickname,
        discord_username: discord_username !== undefined ? discord_username : existing.discord_username,
        role_title: role_title ?? existing.role_title,
        status: status ?? existing.status,
        note: note !== undefined ? note : existing.note,
        joined_at: joined_at ? new Date(joined_at) : existing.joined_at,
      },
    })

    res.json(citizen)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// DELETE /api/citizens/:id
router.delete('/:id', requireAuth, requirePermission('citizens.delete'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const existing = await prisma.citizen.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!existing) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    if (existing.user) {
      res.status(400).json({ error: 'Нельзя удалить гражданина, привязанного к аккаунту' })
      return
    }

    await prisma.citizen.delete({ where: { id } })

    res.json({ message: 'Гражданин удалён' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/citizens/:id/pdf
router.get('/:id/pdf', requireAuth, requirePermission('citizens.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const citizen = await prisma.citizen.findFirst({
      where: { OR: [{ id }, { reg_number: id }] },
      include: {
        passports: {
          orderBy: { issued_at: 'desc' },
          take: 1,
        },
        punishments: {
          where: { status: 'ACTIVE' },
          orderBy: { issued_at: 'desc' },
          include: { issued_by: { select: { id: true, login: true } } },
        },
        tax_charges: {
          where: { status: 'UNPAID' },
          include: { period: true },
        },
        buildings: {
          where: { status: 'ACTIVE' },
          orderBy: { created_at: 'desc' },
        },
      },
    })
    if (!citizen) {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }

    const seed = citizen.reg_number
    const barcode = barcodeStripes(citizen.reg_number, 240, 38)
    const joinedDate = new Date(citizen.joined_at).toLocaleDateString('ru-RU')
    const printDate = new Date().toLocaleDateString('ru-RU')

    const statusLabels: Record<CitizenStatus, string> = {
      ACTIVE: 'Активен',
      INACTIVE: 'Неактивен',
      UNDER_INVESTIGATION: 'Под следствием',
      EXILED: 'В изгнании',
      BANNED: 'Забанен',
    }
    const statusColors: Record<CitizenStatus, string> = {
      ACTIVE: '#16A34A',
      INACTIVE: '#6B7280',
      UNDER_INVESTIGATION: '#D97706',
      EXILED: '#7C3AED',
      BANNED: '#DC2626',
    }

    const totalDebt = citizen.tax_charges.reduce((s, c) => s + c.amount, 0)
    const latestPassport = citizen.passports[0] ?? null

    const punishmentsHtml = citizen.punishments.length > 0
      ? citizen.punishments.map((p) => `
        <tr>
          <td style="padding:6px 8px;font-size:13px;color:#374151;border-bottom:1px solid #F3F4F6;">${p.type}</td>
          <td style="padding:6px 8px;font-size:13px;color:#374151;border-bottom:1px solid #F3F4F6;">${p.reason}</td>
          <td style="padding:6px 8px;font-size:12px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${new Date(p.issued_at).toLocaleDateString('ru-RU')}</td>
        </tr>`).join('')
      : `<tr><td colspan="3" style="padding:10px 8px;font-size:13px;color:#9CA3AF;text-align:center;">Нет активных наказаний</td></tr>`

    const buildingsHtml = citizen.buildings.length > 0
      ? citizen.buildings.map((b) => `
        <tr>
          <td style="padding:6px 8px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#1B3A6B;border-bottom:1px solid #F3F4F6;">${b.reg_number}</td>
          <td style="padding:6px 8px;font-size:13px;color:#374151;border-bottom:1px solid #F3F4F6;">${b.name}</td>
          <td style="padding:6px 8px;font-size:12px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${b.coord_x}, ${b.coord_y}, ${b.coord_z}</td>
        </tr>`).join('')
      : `<tr><td colspan="3" style="padding:10px 8px;font-size:13px;color:#9CA3AF;text-align:center;">Нет объектов</td></tr>`

    const fld = (label: string, value: string, mono = false) =>
      `<div class="cz-field"><div class="cz-label">${label}</div><div class="cz-value"${mono ? ' style="font-family:\'JetBrains Mono\',monospace;color:#1B3A6B;"' : ''}>${value}</div></div>`

    const header = `<div class="cz-header">
      <div class="cz-emblem">${guillocheRosette(seed, 70)}</div>
      <div class="cz-head-text">
        <div class="cz-state">ГОСУДАРСТВО ПЕЛЬАГРИЯ</div>
        <div class="cz-title">ЛИЧНОЕ ДЕЛО ГРАЖДАНИНА</div>
        <div class="cz-sub">Конфиденциально · ${printDate}</div>
      </div>
      <div class="cz-photo">ФОТО</div>
    </div>`

    const body = `
      <div class="cz-regbar">
        <div>
          <div class="cz-label">Регистрационный номер</div>
          <div class="cz-reg">${citizen.reg_number}</div>
        </div>
        <div class="cz-status" style="color:${statusColors[citizen.status]};border-color:${statusColors[citizen.status]}66;background:${statusColors[citizen.status]}0D;">${statusLabels[citizen.status]}</div>
      </div>

      <div class="cz-section-title">Личные данные</div>
      <div class="cz-grid">
        ${fld('Никнейм', citizen.nickname)}
        ${fld('Discord', citizen.discord_username ?? '—')}
        ${fld('Роль', citizen.role_title)}
        ${fld('Дата вступления', joinedDate)}
      </div>
      ${citizen.note ? `<div class="cz-note">${citizen.note}</div>` : ''}

      <div class="cz-section-title">Паспорт</div>
      ${latestPassport ? `<div class="cz-grid">
        ${fld('Номер', latestPassport.number, true)}
        ${fld('Дата выдачи', new Date(latestPassport.issued_at).toLocaleDateString('ru-RU'))}
        ${fld('Статус', latestPassport.status)}
        ${fld('Действителен до', latestPassport.expires_at ? new Date(latestPassport.expires_at).toLocaleDateString('ru-RU') : 'Бессрочно')}
      </div>` : `<div class="cz-empty">Паспорт не выдан</div>`}

      <div class="cz-section-title">Активные наказания</div>
      <table class="cz-table"><thead><tr><th>Тип</th><th>Причина</th><th>Дата</th></tr></thead><tbody>${punishmentsHtml}</tbody></table>

      <div class="cz-section-title">Налоговый долг</div>
      <div class="cz-debt">${totalDebt} у.е.</div>

      <div class="cz-section-title">Постройки (активные)</div>
      <table class="cz-table"><thead><tr><th>Номер</th><th>Название</th><th>Координаты</th></tr></thead><tbody>${buildingsHtml}</tbody></table>
    `

    const footer = `
      <div class="cz-footer">
        <div style="font-size:12px;color:#6B7280;">Дата составления: ${printDate}</div>
        <div class="cz-barcode">${barcode}<div class="cz-barcode-text">${citizen.reg_number}</div></div>
      </div>
      <div class="cz-foot-strip">Конфиденциально — только для служебного пользования · СОНАР</div>
    `

    const styles = `
      .cz-header { display:flex; align-items:center; gap:16px; border-bottom:3px solid ${INK}; padding-bottom:14px; }
      .cz-emblem { width:58px; height:58px; flex-shrink:0; }
      .cz-emblem svg { width:58px; height:58px; }
      .cz-head-text { flex:1; }
      .cz-state { font-size:11px; letter-spacing:4px; color:${ACCENT}; font-weight:600; }
      .cz-title { font-size:22px; font-weight:700; letter-spacing:0.06em; color:${INK}; margin-top:4px; }
      .cz-sub { font-size:10px; color:#9CA3AF; margin-top:5px; }
      .cz-photo { width:60px; height:74px; border:1.5px dashed #D0D7E3; border-radius:3px; display:flex; align-items:center; justify-content:center; font-size:9px; color:#C4C9D4; flex-shrink:0; }
      .cz-regbar { display:flex; align-items:center; justify-content:space-between; padding:18px 0; border-bottom:2px solid ${ACCENT}22; margin-bottom:20px; }
      .cz-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
      .cz-reg { font-family:'JetBrains Mono',monospace; font-size:30px; font-weight:700; color:${INK}; letter-spacing:0.06em; }
      .cz-status { font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; border:1px solid; border-radius:3px; padding:4px 12px; }
      .cz-section-title { font-size:12px; font-weight:700; color:${INK}; text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid #E5E7EB; padding-bottom:6px; margin:22px 0 12px; }
      .cz-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px 28px; }
      .cz-value { font-size:14px; color:#1F2937; font-weight:500; }
      .cz-note { font-size:13px; color:#374151; background:#F8F9FB; padding:10px 14px; border-radius:4px; border-left:3px solid ${ACCENT}; margin-top:10px; }
      .cz-empty { font-size:13px; color:#9CA3AF; }
      .cz-table { width:100%; border-collapse:collapse; }
      .cz-table th { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.06em; padding:6px 8px; text-align:left; border-bottom:2px solid ${INK}; }
      .cz-debt { font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:700; color:${totalDebt > 0 ? '#DC2626' : '#16A34A'}; }
      .cz-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid ${INK}; padding-top:16px; margin-top:20px; }
      .cz-barcode { display:flex; flex-direction:column; align-items:center; gap:4px; }
      .cz-barcode-text { font-family:'JetBrains Mono',monospace; font-size:9px; color:#9CA3AF; }
      .cz-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:12px; }
    `

    const watermark = `<div style="width:520px;height:520px;">${guillocheRosette(seed + ':wm', 520)}</div>`
    const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, watermark, kind: 'citizen' })
    const pdfBuffer = await htmlToPdf(html)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="citizen-${citizen.reg_number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
  }
})

export default router

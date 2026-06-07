import { Router, Request, Response } from 'express'
import { PrismaClient, Prisma, CitizenStatus } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern, barcodeStripes } from '../services/templates'

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

    const guilloche = guillochePattern(citizen.reg_number, 794, 50)
    const barcode = barcodeStripes(citizen.reg_number, 240, 40)
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
  .reg-banner { padding: 20px 40px; border-bottom: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: space-between; }
  .reg-number { font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 700; color: #0A1628; letter-spacing: 0.06em; }
  .status-badge { display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${statusColors[citizen.status]}; background: ${statusColors[citizen.status]}15; border: 1px solid ${statusColors[citizen.status]}44; border-radius: 3px; padding: 3px 10px; }
  .content { padding: 28px 40px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 28px; }
  .field-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .field-value { font-size: 14px; color: #1F2937; font-weight: 500; }
  .section-title { font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin-bottom: 12px; }
  .section { margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 8px; text-align: left; border-bottom: 2px solid #E5E7EB; }
  .debt-amount { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; color: ${totalDebt > 0 ? '#DC2626' : '#16A34A'}; }
  .footer { border-top: 1px solid #E5E7EB; background: #F8F9FB; padding: 16px 40px; display: flex; justify-content: space-between; align-items: center; }
  .barcode-block { display: flex; flex-direction: column; align-items: center; gap: 5px; }
  .barcode-text { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #9CA3AF; }
  .doc-footer-strip { padding: 10px 40px; display: flex; justify-content: space-between; font-size: 10px; color: #C4C9D4; border-top: 1px solid #F0F2F5; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
    <div class="header-center">
      <div class="header-doctype">Личное дело гражданина</div>
      <div class="header-sub">ГОСУДАРСТВЕННАЯ ИНФОРМАЦИОННАЯ СИСТЕМА СОНАР</div>
    </div>
    <div class="header-right">${printDate}</div>
  </div>
  <div class="guilloche-bar">${guilloche}</div>

  <div class="reg-banner">
    <div>
      <div class="field-label">Регистрационный номер</div>
      <div class="reg-number">${citizen.reg_number}</div>
    </div>
    <div class="status-badge">${statusLabels[citizen.status]}</div>
  </div>

  <div class="content">
    <div class="section">
      <div class="section-title">Личные данные</div>
      <div class="fields">
        <div>
          <div class="field-label">Никнейм</div>
          <div class="field-value">${citizen.nickname}</div>
        </div>
        <div>
          <div class="field-label">Discord</div>
          <div class="field-value">${citizen.discord_username ?? '—'}</div>
        </div>
        <div>
          <div class="field-label">Роль</div>
          <div class="field-value">${citizen.role_title}</div>
        </div>
        <div>
          <div class="field-label">Дата вступления</div>
          <div class="field-value">${joinedDate}</div>
        </div>
      </div>
      ${citizen.note ? `<div class="field-label" style="margin-bottom:4px;">Примечание</div><div style="font-size:13px;color:#374151;background:#F8F9FB;padding:10px 14px;border-radius:4px;border-left:3px solid #D0D7E3;">${citizen.note}</div>` : ''}
    </div>

    <div class="section">
      <div class="section-title">Паспорт</div>
      ${latestPassport ? `
      <div class="fields" style="margin-bottom:0;">
        <div>
          <div class="field-label">Номер</div>
          <div class="field-value" style="font-family:'JetBrains Mono',monospace;">${latestPassport.number}</div>
        </div>
        <div>
          <div class="field-label">Дата выдачи</div>
          <div class="field-value">${new Date(latestPassport.issued_at).toLocaleDateString('ru-RU')}</div>
        </div>
        <div>
          <div class="field-label">Статус</div>
          <div class="field-value">${latestPassport.status}</div>
        </div>
        <div>
          <div class="field-label">Действителен до</div>
          <div class="field-value">${latestPassport.expires_at ? new Date(latestPassport.expires_at).toLocaleDateString('ru-RU') : 'Бессрочно'}</div>
        </div>
      </div>` : `<div style="font-size:13px;color:#9CA3AF;">Паспорт не выдан</div>`}
    </div>

    <div class="section">
      <div class="section-title">Активные наказания</div>
      <table>
        <thead><tr><th>Тип</th><th>Причина</th><th>Дата</th></tr></thead>
        <tbody>${punishmentsHtml}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Налоговый долг</div>
      <div class="debt-amount">${totalDebt} у.е.</div>
    </div>

    <div class="section">
      <div class="section-title">Постройки (активные)</div>
      <table>
        <thead><tr><th>Номер</th><th>Название</th><th>Координаты</th></tr></thead>
        <tbody>${buildingsHtml}</tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <div style="font-size:12px;color:#6B7280;">Дата составления: ${printDate}</div>
    <div class="barcode-block">
      ${barcode}
      <div class="barcode-text">${citizen.reg_number}</div>
    </div>
  </div>
  <div class="doc-footer-strip">
    <span>Государственная информационная система СОНАР</span>
    <span>Конфиденциально — только для служебного пользования</span>
  </div>
</body>
</html>`

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

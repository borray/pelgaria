import { Router, Request, Response } from 'express'
import { PrismaClient, BuildingType, BuildingStatus, Prisma } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import {
  guillocheRosette,
  guillocheField,
  barcodeStripes,
  pageShell,
  parseOptionalDate,
  A4_W,
  ACCENT,
  INK,
} from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

const uploadsDir = path.join(process.cwd(), 'uploads', 'buildings')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})
const allowedScreenshotTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, allowedScreenshotTypes.has(file.mimetype)),
})

async function generateBuildingNumber(): Promise<string> {
  const count = await prisma.building.count()
  const seq = count + 1
  return `РЛК-${String(seq).padStart(4, '0')}`
}

// GET /api/buildings
router.get('/', requireAuth, requirePermission('relict.view'), async (req: Request, res: Response) => {
  try {
    const { type, status, owner_id, search } = req.query as Record<string, string>
    const where: Prisma.BuildingWhereInput = {}
    if (type) where.type = type as BuildingType
    if (status) where.status = status as BuildingStatus
    if (owner_id) where.owner_id = owner_id
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { reg_number: { contains: search, mode: 'insensitive' } },
        { owner: { nickname: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const buildings = await prisma.building.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        owner: { select: { id: true, reg_number: true, nickname: true } },
      },
    })
    res.json(buildings)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/buildings
router.post('/', requireAuth, requirePermission('relict.create'), async (req: Request, res: Response) => {
  try {
    const { name, type, coord_x, coord_y, coord_z, owner_id, status, description, area, dimensions, materials, tax_rate } = req.body
    if (!name || !type || !owner_id) {
      res.status(400).json({ error: 'name, type и owner_id обязательны' })
      return
    }

    let built_at: Date | null
    try {
      built_at = parseOptionalDate(req.body.built_at)
    } catch {
      res.status(400).json({ error: 'Некорректная дата постройки' })
      return
    }

    const reg_number = await generateBuildingNumber()

    const building = await prisma.building.create({
      data: {
        reg_number,
        name,
        type: type as BuildingType,
        coord_x: Number(coord_x) || 0,
        coord_y: Number(coord_y) || 0,
        coord_z: Number(coord_z) || 0,
        owner_id,
        status: (status as BuildingStatus) || 'ACTIVE',
        description: description || null,
        area: area ? Number(area) : null,
        dimensions: dimensions || null,
        materials: materials || null,
        tax_rate: Number(tax_rate) || 0,
        built_at,
      },
      include: {
        owner: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    res.status(201).json(building)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// GET /api/buildings/registry/pdf  — must be before /:id to avoid route shadowing
router.get('/registry/pdf', requireAuth, requirePermission('relict.view'), async (_req: Request, res: Response) => {
  try {
    const buildings = await prisma.building.findMany({
      orderBy: { reg_number: 'asc' },
      include: {
        owner: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    const seed = 'РЛК-РЕЕСТР'
    const printDate = new Date().toLocaleDateString('ru-RU')

    const totalTax = buildings.reduce((s, b) => s + b.tax_rate, 0)

    const typeLabels: Record<BuildingType, string> = {
      RESIDENTIAL: 'Жилое',
      GOVERNMENT: 'Государственное',
      COMMERCIAL: 'Коммерческое',
      MILITARY: 'Военное',
    }
    const statusLabels: Record<BuildingStatus, string> = {
      ACTIVE: 'Активен',
      UNDER_CONSTRUCTION: 'В строительстве',
      ABANDONED: 'Заброшен',
      DEMOLISHED: 'Снесён',
    }
    const statusColors: Record<BuildingStatus, string> = {
      ACTIVE: '#16A34A',
      UNDER_CONSTRUCTION: '#D97706',
      ABANDONED: '#6B7280',
      DEMOLISHED: '#DC2626',
    }

    const rowsHtml = buildings.map((b, i) => `
      <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#F9FAFB'};">
        <td style="padding:6px 8px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#1B3A6B;border-bottom:1px solid #F3F4F6;">${b.reg_number}</td>
        <td style="padding:6px 8px;font-size:12px;font-weight:500;color:#0A1628;border-bottom:1px solid #F3F4F6;">${b.name}</td>
        <td style="padding:6px 8px;font-size:11px;color:#374151;border-bottom:1px solid #F3F4F6;">${typeLabels[b.type] ?? b.type}</td>
        <td style="padding:6px 8px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${b.coord_x},${b.coord_y},${b.coord_z}</td>
        <td style="padding:6px 8px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">${b.owner?.nickname ?? '—'}</td>
        <td style="padding:6px 8px;font-size:11px;font-weight:600;color:${statusColors[b.status]};border-bottom:1px solid #F3F4F6;">${statusLabels[b.status] ?? b.status}</td>
        <td style="padding:6px 8px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#374151;text-align:right;border-bottom:1px solid #F3F4F6;">${b.tax_rate}</td>
      </tr>`).join('')

    const header = `<div class="rg-header">
      <div class="rg-emblem">${guillocheRosette(seed, 70)}</div>
      <div class="rg-head-text">
        <div class="rg-state">ГОСУДАРСТВО ПЕЛЬГАРИЯ</div>
        <div class="rg-title">РЕЕСТР ПОСТРОЕК · РЕЛИКТ</div>
        <div class="rg-sub">Государственная информационная система СОНАР · ${printDate}</div>
      </div>
    </div>`

    const body = `
      <div class="rg-summary">
        <div class="rg-sum"><div class="rg-sum-label">Объектов всего</div><div class="rg-sum-value">${buildings.length}</div></div>
        <div class="rg-sum"><div class="rg-sum-label">Активных</div><div class="rg-sum-value">${buildings.filter((b) => b.status === 'ACTIVE').length}</div></div>
        <div class="rg-sum"><div class="rg-sum-label">Суммарный налог</div><div class="rg-sum-value">${totalTax} у.е.</div></div>
      </div>
      <table class="rg-table">
        <thead>
          <tr>
            <th style="width:84px;">Номер</th>
            <th>Название</th>
            <th style="width:88px;">Тип</th>
            <th style="width:104px;">Координаты</th>
            <th style="width:104px;">Владелец</th>
            <th style="width:88px;">Статус</th>
            <th style="width:56px;text-align:right;">Налог</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="rg-totals">
            <td></td><td>ИТОГО</td><td></td><td></td><td></td>
            <td>${buildings.filter((b) => b.status === 'ACTIVE').length} активных</td>
            <td style="font-family:'JetBrains Mono',monospace;text-align:right;">${totalTax}</td>
          </tr>
        </tbody>
      </table>
    `

    const footer = `
      <div class="rg-footer">
        <span>Дата составления: ${printDate}</span>
        <span>Реестр объектов государства Пельгария</span>
      </div>
    `

    const styles = `
      .rg-header { display:flex; align-items:center; gap:16px; background:${INK}; color:#fff; padding:14px 20px; border-radius:3px; }
      .rg-emblem { width:56px; height:56px; flex-shrink:0; filter:invert(1) opacity(0.85); }
      .rg-emblem svg { width:56px; height:56px; }
      .rg-head-text { flex:1; text-align:center; }
      .rg-state { font-size:11px; letter-spacing:4px; color:rgba(255,255,255,0.65); }
      .rg-title { font-size:21px; font-weight:700; letter-spacing:0.1em; margin-top:4px; }
      .rg-sub { font-size:10px; color:rgba(255,255,255,0.5); margin-top:5px; }
      .rg-summary { display:flex; gap:40px; padding:18px 4px; border-bottom:2px solid ${ACCENT}33; margin-bottom:18px; }
      .rg-sum-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }
      .rg-sum-value { font-family:'JetBrains Mono',monospace; font-size:18px; font-weight:700; color:${INK}; }
      .rg-table { width:100%; border-collapse:collapse; }
      .rg-table th { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.06em; padding:7px 8px; text-align:left; border-bottom:2px solid ${INK}; }
      .rg-totals td { padding:9px 8px; font-size:12px; font-weight:700; color:${INK}; border-top:2px solid ${INK}; background:#F0F4FA; }
      .rg-footer { display:flex; justify-content:space-between; border-top:2px solid ${INK}; padding-top:14px; font-size:11px; color:#6B7280; }
    `

    const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, kind: 'registry' })
    const pdfBuffer = await htmlToPdf(html)
    res.set(pdfHeaders(pdfBuffer, `buildings-registry-${printDate.replace(/\./g, '-')}.pdf`))
    res.send(pdfBuffer)
  } catch (err) {
    res.status(500).json(pdfError(err, 'building registry'))
  }
})

// GET /api/buildings/:id/pdf — technical passport (РЕЛИКТ) for a single object
router.get('/:id/pdf', requireAuth, requirePermission('relict.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const building = await prisma.building.findFirst({
      where: { OR: [{ id }, { reg_number: id }] },
      include: {
        owner: { select: { id: true, reg_number: true, nickname: true } },
      },
    })
    if (!building) {
      res.status(404).json({ error: 'Объект не найден' })
      return
    }

    const seed = building.reg_number
    const printDate = new Date().toLocaleDateString('ru-RU')
    const builtDate = (building.built_at ?? building.created_at)
      ? new Date(building.built_at ?? building.created_at).toLocaleDateString('ru-RU')
      : '—'

    const typeLabels: Record<BuildingType, string> = {
      RESIDENTIAL: 'Жилое',
      GOVERNMENT: 'Государственное',
      COMMERCIAL: 'Коммерческое',
      MILITARY: 'Военное',
    }
    const statusLabels: Record<BuildingStatus, string> = {
      ACTIVE: 'Активен',
      UNDER_CONSTRUCTION: 'В строительстве',
      ABANDONED: 'Заброшен',
      DEMOLISHED: 'Снесён',
    }
    const statusColors: Record<BuildingStatus, string> = {
      ACTIVE: '#16A34A',
      UNDER_CONSTRUCTION: '#D97706',
      ABANDONED: '#6B7280',
      DEMOLISHED: '#DC2626',
    }

    const barcode = barcodeStripes(building.reg_number, 240, 36)

    const spec = (label: string, value: string, mono = false) =>
      `<tr><td class="rk-spec-label">${label}</td><td class="rk-spec-value"${mono ? ' style="font-family:\'JetBrains Mono\',monospace;color:#1B3A6B;"' : ''}>${value}</td></tr>`

    const header = `<div class="rk-header">
      <div class="rk-emblem">${guillocheRosette(seed, 84)}</div>
      <div class="rk-head-text">
        <div class="rk-state">ГОСУДАРСТВО ПЕЛЬГАРИЯ · РЕЛИКТ</div>
        <div class="rk-title">ТЕХНИЧЕСКИЙ ПАСПОРТ ОБЪЕКТА</div>
        <div class="rk-num">${building.reg_number}</div>
      </div>
    </div>`

    const body = `
      <div class="rk-namebar">
        <div>
          <div class="rk-label">Наименование объекта</div>
          <div class="rk-name">${building.name}</div>
        </div>
        <div class="rk-status" style="color:${statusColors[building.status]};border-color:${statusColors[building.status]}66;background:${statusColors[building.status]}0D;">${statusLabels[building.status] ?? building.status}</div>
      </div>
      <div class="rk-section-label">Спецификация</div>
      <table class="rk-specs">
        ${spec('Регистрационный номер', building.reg_number, true)}
        ${spec('Тип объекта', typeLabels[building.type] ?? building.type)}
        ${spec('Координаты (X / Y / Z)', `${building.coord_x} / ${building.coord_y} / ${building.coord_z}`, true)}
        ${spec('Площадь', building.area != null ? `${building.area} м²` : '—')}
        ${spec('Габариты', building.dimensions ?? '—')}
        ${spec('Материалы', building.materials ?? '—')}
        ${spec('Владелец', building.owner ? `${building.owner.nickname} (${building.owner.reg_number})` : '—')}
        ${spec('Дата постройки', builtDate)}
        ${spec('Налоговая ставка', `${building.tax_rate} у.е.`, true)}
      </table>
      ${building.description ? `<div class="rk-section-label" style="margin-top:20px;">Описание</div><div class="rk-desc">${building.description}</div>` : ''}
      <div class="rk-fill">${guillocheField(seed + ':fill', A4_W - 130, 80, 0.1)}</div>
    `

    const footer = `
      <div class="rk-footer">
        <div class="rk-barcode">${barcode}<div class="rk-barcode-text">${building.reg_number}</div></div>
        <div class="rk-sign">
          <div class="rk-sign-line"></div>
          <div class="rk-sign-label">Уполномоченный по реестру РЕЛИКТ</div>
        </div>
      </div>
      <div class="rk-foot-strip">Реестр объектов государства Пельгария · Дата печати: ${printDate}</div>
    `

    const styles = `
      .rk-header { display:flex; align-items:center; gap:18px; border-bottom:3px solid ${INK}; padding-bottom:16px; }
      .rk-emblem { width:74px; height:74px; flex-shrink:0; }
      .rk-emblem svg { width:74px; height:74px; }
      .rk-head-text { flex:1; }
      .rk-state { font-size:11px; letter-spacing:3px; color:${ACCENT}; font-weight:600; }
      .rk-title { font-size:24px; font-weight:700; letter-spacing:0.06em; color:${INK}; margin-top:6px; }
      .rk-num { font-family:'JetBrains Mono',monospace; font-size:15px; color:${ACCENT}; margin-top:6px; }
      .rk-namebar { display:flex; align-items:flex-start; justify-content:space-between; margin:22px 0 24px; }
      .rk-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
      .rk-name { font-size:22px; font-weight:700; color:${INK}; }
      .rk-status { font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; border:1px solid; border-radius:3px; padding:4px 12px; }
      .rk-section-label { font-size:11px; font-weight:700; color:${INK}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
      .rk-specs { width:100%; border-collapse:collapse; }
      .rk-spec-label { width:230px; font-size:11px; color:#6B7280; text-transform:uppercase; letter-spacing:0.04em; padding:9px 8px; border-bottom:1px solid #EDF0F4; vertical-align:top; }
      .rk-spec-value { font-size:14px; color:#1F2937; font-weight:500; padding:9px 8px; border-bottom:1px solid #EDF0F4; }
      .rk-desc { font-size:14px; color:#374151; line-height:1.7; white-space:pre-wrap; background:#F8F9FB; border-left:3px solid ${ACCENT}; padding:16px 20px; border-radius:0 4px 4px 0; }
      .rk-fill { margin-top:18px; }
      .rk-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid ${INK}; padding-top:18px; }
      .rk-barcode { display:flex; flex-direction:column; gap:4px; }
      .rk-barcode-text { font-family:'JetBrains Mono',monospace; font-size:9px; color:#9CA3AF; }
      .rk-sign { text-align:right; }
      .rk-sign-line { width:200px; border-bottom:1px solid #6B7280; height:8px; margin-left:auto; }
      .rk-sign-label { font-size:11px; color:#6B7280; font-style:italic; margin-top:5px; }
      .rk-foot-strip { text-align:center; font-size:9px; color:#9CA3AF; margin-top:12px; }
    `

    const watermark = `<div style="width:520px;height:520px;">${guillocheRosette(seed + ':wm', 520)}</div>`
    const html = pageShell({ seed, accent: ACCENT, header, body, footer, styles, watermark, kind: 'building' })
    const pdfBuffer = await htmlToPdf(html)
    res.set(pdfHeaders(pdfBuffer, `building-${building.reg_number}.pdf`))
    res.send(pdfBuffer)
  } catch (err) {
    res.status(500).json(pdfError(err, 'building certificate'))
  }
})

// GET /api/buildings/:id
router.get('/:id', requireAuth, requirePermission('relict.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const building = await prisma.building.findFirst({
      where: { OR: [{ id }, { reg_number: id }] },
      include: {
        owner: { select: { id: true, reg_number: true, nickname: true } },
        tax_charges: {
          orderBy: { period: { starts_at: 'desc' } },
          include: { period: true },
        },
      },
    })
    if (!building) {
      res.status(404).json({ error: 'Объект не найден' })
      return
    }
    res.json(building)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// PUT / PATCH /api/buildings/:id — PATCH supports editing built_at (and other fields)
router.put('/:id', requireAuth, requirePermission('relict.edit'), updateBuilding)
router.patch('/:id', requireAuth, requirePermission('relict.edit'), updateBuilding)
async function updateBuilding(req: Request, res: Response) {
  try {
    const id = req.params.id as string
    const { name, type, coord_x, coord_y, coord_z, owner_id, status, description, area, dimensions, materials, tax_rate } = req.body

    const existing = await prisma.building.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Объект не найден' })
      return
    }

    let built_at: Date | null | undefined = undefined
    if (req.body.built_at !== undefined) {
      try {
        built_at = parseOptionalDate(req.body.built_at)
      } catch {
        res.status(400).json({ error: 'Некорректная дата постройки' })
        return
      }
    }

    const building = await prisma.building.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        type: (type as BuildingType) ?? existing.type,
        coord_x: coord_x !== undefined ? Number(coord_x) : existing.coord_x,
        coord_y: coord_y !== undefined ? Number(coord_y) : existing.coord_y,
        coord_z: coord_z !== undefined ? Number(coord_z) : existing.coord_z,
        owner_id: owner_id ?? existing.owner_id,
        status: (status as BuildingStatus) ?? existing.status,
        description: description !== undefined ? description : existing.description,
        area: area !== undefined ? (area ? Number(area) : null) : existing.area,
        dimensions: dimensions !== undefined ? dimensions : existing.dimensions,
        materials: materials !== undefined ? materials : existing.materials,
        tax_rate: tax_rate !== undefined ? Number(tax_rate) : existing.tax_rate,
        ...(built_at !== undefined && { built_at }),
      },
      include: {
        owner: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    res.json(building)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
}

// DELETE /api/buildings/:id
router.delete('/:id', requireAuth, requirePermission('relict.delete'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const existing = await prisma.building.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Объект не найден' })
      return
    }

    if (existing.screenshot_url) {
      const filePath = path.join(process.cwd(), existing.screenshot_url.replace('/uploads', 'uploads'))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await prisma.building.delete({ where: { id } })
    res.json({ message: 'Объект удалён' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// POST /api/buildings/:id/screenshot
router.post('/:id/screenshot', requireAuth, requirePermission('relict.edit'), upload.single('screenshot'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const existing = await prisma.building.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Объект не найден' })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' })
      return
    }

    if (existing.screenshot_url) {
      const oldPath = path.join(process.cwd(), existing.screenshot_url.replace('/uploads', 'uploads'))
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    }

    const screenshot_url = `/uploads/buildings/${req.file.filename}`

    const building = await prisma.building.update({
      where: { id },
      data: { screenshot_url },
      include: {
        owner: { select: { id: true, reg_number: true, nickname: true } },
      },
    })

    res.json(building)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

export default router

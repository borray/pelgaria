import { Router, Request, Response } from 'express'
import { PrismaClient, BuildingType, BuildingStatus, Prisma } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { htmlToPdf } from '../services/pdf'
import { guillochePattern } from '../services/templates'

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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

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

    const guilloche = guillochePattern('buildings-registry', 794, 40)
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
  .header-doctype { color: #FFFFFF; font-size: 17px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .header-sub { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 3px; }
  .header-right { width: 180px; text-align: right; font-size: 12px; color: rgba(255,255,255,0.5); }
  .guilloche-bar { overflow: hidden; height: 40px; background: #F8F9FB; border-bottom: 1px solid #E5E7EB; }
  .summary-bar { padding: 14px 40px; background: #F0F4FA; border-bottom: 1px solid #D0D7E3; display: flex; gap: 40px; }
  .sum-item .sum-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
  .sum-item .sum-value { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: #0A1628; }
  .content { padding: 24px 40px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 9px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; padding: 7px 8px; text-align: left; border-bottom: 2px solid #E5E7EB; background: #F8F9FB; }
  .totals-row td { padding: 9px 8px; font-size: 12px; font-weight: 700; color: #0A1628; border-top: 2px solid #0A1628; background: #F0F4FA; }
  .footer { border-top: 1px solid #E5E7EB; background: #F8F9FB; padding: 14px 40px; display: flex; justify-content: space-between; font-size: 12px; color: #6B7280; }
  .doc-footer-strip { padding: 10px 40px; display: flex; justify-content: space-between; font-size: 10px; color: #C4C9D4; border-top: 1px solid #F0F2F5; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
    <div class="header-center">
      <div class="header-doctype">Реестр построек — Реликт</div>
      <div class="header-sub">ГОСУДАРСТВЕННАЯ ИНФОРМАЦИОННАЯ СИСТЕМА СОНАР</div>
    </div>
    <div class="header-right">${printDate}</div>
  </div>
  <div class="guilloche-bar">${guilloche}</div>

  <div class="summary-bar">
    <div class="sum-item">
      <div class="sum-label">Объектов всего</div>
      <div class="sum-value">${buildings.length}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Активных</div>
      <div class="sum-value">${buildings.filter((b) => b.status === 'ACTIVE').length}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Суммарный налог</div>
      <div class="sum-value">${totalTax} у.е.</div>
    </div>
  </div>

  <div class="content">
    <table>
      <thead>
        <tr>
          <th style="width:90px;">Номер</th>
          <th>Название</th>
          <th style="width:90px;">Тип</th>
          <th style="width:110px;">Координаты</th>
          <th style="width:110px;">Владелец</th>
          <th style="width:90px;">Статус</th>
          <th style="width:60px;text-align:right;">Налог</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="totals-row">
          <td></td>
          <td>ИТОГО</td>
          <td></td>
          <td></td>
          <td></td>
          <td>${buildings.filter((b) => b.status === 'ACTIVE').length} активных</td>
          <td style="font-family:'JetBrains Mono',monospace;text-align:right;">${totalTax}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span>Дата составления: ${printDate}</span>
    <span>Государственная информационная система СОНАР</span>
  </div>
  <div class="doc-footer-strip">
    <span>Реестр объектов государства Пельагрия</span>
    <span>Дата печати: ${printDate}</span>
  </div>
</body>
</html>`

    const pdfBuffer = await htmlToPdf(html)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="buildings-registry-${printDate.replace(/\./g, '-')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка генерации PDF' })
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

// PUT /api/buildings/:id
router.put('/:id', requireAuth, requirePermission('relict.edit'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { name, type, coord_x, coord_y, coord_z, owner_id, status, description, area, dimensions, materials, tax_rate } = req.body

    const existing = await prisma.building.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Объект не найден' })
      return
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
})

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

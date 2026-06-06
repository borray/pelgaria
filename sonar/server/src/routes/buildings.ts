import { Router, Request, Response } from 'express'
import { PrismaClient, BuildingType, BuildingStatus, Prisma } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

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

import fs from 'fs'
import path from 'path'
import multer from 'multer'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'
import { Router, Request, Response } from 'express'
import { Prisma, PrismaClient, ServiceSessionMode, ServiceSessionStatus } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requireHeadOfState, requirePermission } from '../middleware/permissions'
import { nextDocumentNumber, registryCode } from '../services/documentRegistry'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import { barcodeStripes, escapeHtml, pageShell, qrCode, INK } from '../services/templates'

const router = Router()
const prisma = new PrismaClient()
const uploadsDir = path.join(process.cwd(), 'uploads', 'service-center')
fs.mkdirSync(uploadsDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`)
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    if (!allowed.has(file.mimetype)) {
      cb(new Error('Поддерживаются JPG, PNG, WebP и PDF'))
      return
    }
    cb(null, true)
  },
})

const sessionInclude = {
  citizen: { select: { id: true, reg_number: true, nickname: true } },
  operator: { select: { id: true, login: true } },
  printer_check: true,
  attachments: {
    orderBy: { created_at: 'desc' as const },
    include: { uploaded_by: { select: { id: true, login: true } } },
  },
  documents: {
    orderBy: { created_at: 'desc' as const },
    include: { created_by: { select: { id: true, login: true } } },
  },
  requests: {
    orderBy: { created_at: 'desc' as const },
    include: { created_by: { select: { id: true, login: true } } },
  },
}

function removeUploadedFile(file?: Express.Multer.File) {
  if (!file) return
  fs.promises.unlink(file.path).catch(() => undefined)
}

async function latestPrinterCheck(userId: string, login: string) {
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return prisma.printerTestSheet.findFirst({
    where: {
      OR: [
        { created_by_id: userId },
        { created_by_id: null, created_by_login: login },
      ],
      status: 'PASSED',
      checked_at: { gte: threshold },
      expires_at: { gt: new Date() },
    },
    orderBy: { checked_at: 'desc' },
  })
}

async function evaluateScan(filePath: string) {
  const image = sharp(filePath, { density: 150 }).flatten({ background: '#ffffff' }).greyscale()
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()])
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const contrast = stats.channels[0]?.stdev ?? 0
  const mean = stats.channels[0]?.mean ?? 255
  const sizeScore = width >= 1600 && height >= 2200 ? 35 : width >= 1100 && height >= 1500 ? 25 : 10
  const contrastScore = contrast >= 45 ? 35 : contrast >= 28 ? 25 : 10
  const exposureScore = mean >= 145 && mean <= 245 ? 20 : mean >= 110 && mean <= 250 ? 12 : 4
  const formatScore = ['jpeg', 'png', 'webp', 'tiff'].includes(metadata.format ?? '') ? 10 : 5
  const score = Math.min(100, sizeScore + contrastScore + exposureScore + formatScore)
  const issues: string[] = []
  if (width < 1100 || height < 1500) issues.push('Недостаточное разрешение скана')
  if (contrast < 28) issues.push('Низкий контраст печати')
  if (mean < 110) issues.push('Изображение слишком тёмное')
  if (mean > 250) issues.push('Изображение переэкспонировано или лист пуст')
  return {
    score,
    passed: score >= 65,
    report: { width, height, contrast: Math.round(contrast), brightness: Math.round(mean), issues },
  }
}

async function recognizeAttachment(id: string) {
  const attachment = await prisma.serviceAttachment.findUnique({ where: { id } })
  if (!attachment || attachment.mime_type === 'application/pdf') {
    if (attachment) {
      await prisma.serviceAttachment.update({
        where: { id },
        data: { ocr_status: 'MANUAL_REVIEW' },
      })
    }
    return
  }

  await prisma.serviceAttachment.update({ where: { id }, data: { ocr_status: 'PROCESSING' } })
  const filePath = path.join(process.cwd(), attachment.url.replace('/uploads/', 'uploads/'))
  let worker
  try {
    worker = await createWorker(['rus', 'eng'])
    const result = await worker.recognize(filePath)
    const text = result.data.text.trim()
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    await prisma.serviceAttachment.update({
      where: { id },
      data: {
        ocr_status: text ? 'REVIEW' : 'MANUAL_REVIEW',
        ocr_confidence: result.data.confidence,
        ocr_text: text || null,
        extracted_data: { lines: lines.slice(0, 80) },
      },
    })
  } catch (error) {
    console.error('Service scan OCR failed:', error)
    await prisma.serviceAttachment.update({
      where: { id },
      data: { ocr_status: 'MANUAL_REVIEW' },
    }).catch(() => undefined)
  } finally {
    await worker?.terminate().catch(() => undefined)
  }
}

router.get('/readiness', requireAuth, requirePermission('office.view'), async (req: Request, res: Response) => {
  const check = await latestPrinterCheck(req.user!.id, req.user!.login)
  res.json({ ready: Boolean(check), check, valid_until: check?.expires_at ?? null })
})

router.post(
  '/printer-checks/:id/scan',
  requireAuth,
  requirePermission('office.create'),
  upload.single('scan'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Выберите скан пробного листа' })
      return
    }
    try {
      const sheet = await prisma.printerTestSheet.findUnique({ where: { id: req.params.id as string } })
      if (!sheet) {
        removeUploadedFile(req.file)
        res.status(404).json({ error: 'Пробный лист не найден' })
        return
      }
      const belongsToUser = sheet.created_by_id
        ? sheet.created_by_id === req.user!.id
        : sheet.created_by_login === req.user!.login
      if (!belongsToUser && req.user!.role.name !== 'Глава государства') {
        removeUploadedFile(req.file)
        res.status(403).json({ error: 'Можно проверять только собственный пробный лист' })
        return
      }
      if (req.file.mimetype === 'application/pdf') {
        removeUploadedFile(req.file)
        res.status(400).json({ error: 'Для автоматической оценки загрузите изображение JPG, PNG или WebP' })
        return
      }

      const evaluation = await evaluateScan(req.file.path)
      const checkedAt = new Date()
      const updated = await prisma.printerTestSheet.update({
        where: { id: sheet.id },
        data: {
          created_by_id: sheet.created_by_id ?? req.user!.id,
          status: evaluation.passed ? 'PASSED' : 'FAILED',
          scan_url: `/uploads/service-center/${req.file.filename}`,
          scan_filename: req.file.originalname,
          scan_mime_type: req.file.mimetype,
          quality_score: evaluation.score,
          quality_report: evaluation.report,
          checked_at: checkedAt,
          expires_at: evaluation.passed ? new Date(checkedAt.getTime() + 24 * 60 * 60 * 1000) : null,
        },
      })
      res.json(updated)
    } catch (error) {
      removeUploadedFile(req.file)
      console.error(error)
      res.status(500).json({ error: 'Не удалось оценить пробный лист' })
    }
  }
)

router.get('/sessions', requireAuth, requirePermission('office.view'), async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const status = typeof req.query.status === 'string' ? req.query.status : ''
  const mode = typeof req.query.mode === 'string' ? req.query.mode : ''
  const sessions = await prisma.serviceSession.findMany({
    where: {
      ...(status ? { status: status as ServiceSessionStatus } : {}),
      ...(mode ? { mode: mode as ServiceSessionMode } : {}),
      ...(search ? {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { registry_code: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { citizen: { nickname: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    },
    orderBy: { started_at: 'desc' },
    include: {
      citizen: { select: { id: true, reg_number: true, nickname: true } },
      operator: { select: { id: true, login: true } },
      _count: { select: { attachments: true, documents: true, requests: true } },
    },
  })
  res.json(sessions)
})

router.post('/sessions', requireAuth, requirePermission('office.create'), async (req: Request, res: Response) => {
  const mode = req.body.mode as ServiceSessionMode
  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : ''
  if (!Object.values(ServiceSessionMode).includes(mode) || !subject) {
    res.status(400).json({ error: 'Укажите режим и предмет обслуживания' })
    return
  }

  const session = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, 'SERVICE_SESSION', 'КОНТ')
    return tx.serviceSession.create({
      data: {
        number,
        registry_code: registryCode('КОНТ', number),
        mode,
        subject,
        contact: typeof req.body.contact === 'string' ? req.body.contact.trim() || null : null,
        citizen_id: req.body.citizen_id || null,
        operator_id: req.user!.id,
        printer_check_id: null,
        printer_check_bypassed: false,
        data: typeof req.body.data === 'object' && req.body.data ? req.body.data as Prisma.InputJsonValue : {},
      },
      include: sessionInclude,
    })
  })
  res.status(201).json(session)
})

router.get('/sessions/:id', requireAuth, requirePermission('office.view'), async (req: Request, res: Response) => {
  const session = await prisma.serviceSession.findUnique({
    where: { id: req.params.id as string },
    include: sessionInclude,
  })
  if (!session) {
    res.status(404).json({ error: 'Сессия не найдена' })
    return
  }
  res.json(session)
})

router.patch('/sessions/:id', requireAuth, requirePermission('office.manage'), async (req: Request, res: Response) => {
  const status = req.body.status as ServiceSessionStatus | undefined
  const session = await prisma.serviceSession.update({
    where: { id: req.params.id as string },
    data: {
      ...(status && Object.values(ServiceSessionStatus).includes(status) ? {
        status,
        completed_at: status === 'COMPLETED' ? new Date() : status === 'ACTIVE' ? null : undefined,
      } : {}),
      ...(typeof req.body.subject === 'string' ? { subject: req.body.subject.trim() } : {}),
      ...(typeof req.body.contact === 'string' ? { contact: req.body.contact.trim() || null } : {}),
      ...(req.body.citizen_id !== undefined ? { citizen_id: req.body.citizen_id || null } : {}),
      ...(typeof req.body.data === 'object' && req.body.data ? { data: req.body.data as Prisma.InputJsonValue } : {}),
    },
    include: sessionInclude,
  })
  res.json(session)
})

router.post(
  '/sessions/:id/attachments',
  requireAuth,
  requirePermission('office.create'),
  upload.array('files', 12),
  async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) ?? []
    if (files.length === 0) {
      res.status(400).json({ error: 'Выберите хотя бы один файл' })
      return
    }
    try {
      const session = await prisma.serviceSession.findUnique({ where: { id: req.params.id as string } })
      if (!session) {
        files.forEach(removeUploadedFile)
        res.status(404).json({ error: 'Сессия не найдена' })
        return
      }
      const attachments = await prisma.$transaction(files.map((file) =>
        prisma.serviceAttachment.create({
          data: {
            session_id: session.id,
            kind: req.body.kind === 'APPLICATION' ? 'APPLICATION' : 'SCAN',
            filename: file.filename,
            original_name: file.originalname,
            mime_type: file.mimetype,
            size: file.size,
            url: `/uploads/service-center/${file.filename}`,
            ocr_status: file.mimetype.startsWith('image/') ? 'PENDING' : 'MANUAL_REVIEW',
            uploaded_by_id: req.user!.id,
          },
          include: { uploaded_by: { select: { id: true, login: true } } },
        })
      ))
      await prisma.serviceSession.update({
        where: { id: session.id },
        data: { status: session.mode === 'OFFLINE' ? 'REVIEW' : session.status },
      })
      for (const attachment of attachments) {
        if (attachment.mime_type.startsWith('image/')) void recognizeAttachment(attachment.id)
      }
      res.status(201).json(attachments)
    } catch (error) {
      files.forEach(removeUploadedFile)
      console.error(error)
      res.status(500).json({ error: 'Не удалось сохранить приложения' })
    }
  }
)

router.post('/attachments/:id/analyze', requireAuth, requirePermission('office.manage'), async (req: Request, res: Response) => {
  const attachment = await prisma.serviceAttachment.findUnique({ where: { id: req.params.id as string } })
  if (!attachment) {
    res.status(404).json({ error: 'Файл не найден' })
    return
  }
  void recognizeAttachment(attachment.id)
  res.status(202).json({ status: 'PROCESSING' })
})

router.patch('/attachments/:id', requireAuth, requirePermission('office.manage'), async (req: Request, res: Response) => {
  const attachment = await prisma.serviceAttachment.update({
    where: { id: req.params.id as string },
    data: {
      ...(typeof req.body.ocr_text === 'string' ? { ocr_text: req.body.ocr_text, ocr_status: 'VERIFIED' } : {}),
      ...(typeof req.body.extracted_data === 'object' && req.body.extracted_data
        ? { extracted_data: req.body.extracted_data as Prisma.InputJsonValue, ocr_status: 'VERIFIED' }
        : {}),
    },
  })
  res.json(attachment)
})

router.delete('/attachments/:id', requireAuth, requireHeadOfState, async (req: Request, res: Response) => {
  const attachment = await prisma.serviceAttachment.findUnique({ where: { id: req.params.id as string } })
  if (!attachment) {
    res.status(404).json({ error: 'Файл не найден' })
    return
  }
  await prisma.serviceAttachment.delete({ where: { id: attachment.id } })
  const filePath = path.join(process.cwd(), attachment.url.replace('/uploads/', 'uploads/'))
  await fs.promises.unlink(filePath).catch(() => undefined)
  res.status(204).end()
})

router.delete('/documents/:id', requireAuth, requireHeadOfState, async (req: Request, res: Response) => {
  const document = await prisma.generatedDocument.findUnique({ where: { id: req.params.id as string } })
  if (!document) {
    res.status(404).json({ error: 'Документ не найден' })
    return
  }
  await prisma.generatedDocument.delete({ where: { id: document.id } })
  res.status(204).end()
})

router.delete('/requests/:id', requireAuth, requireHeadOfState, async (req: Request, res: Response) => {
  const request = await prisma.serviceRequest.findUnique({ where: { id: req.params.id as string } })
  if (!request) {
    res.status(404).json({ error: 'Обращение не найдено' })
    return
  }
  await prisma.serviceRequest.delete({ where: { id: request.id } })
  res.status(204).end()
})

router.delete('/sessions/:id', requireAuth, requireHeadOfState, async (req: Request, res: Response) => {
  const session = await prisma.serviceSession.findUnique({
    where: { id: req.params.id as string },
    include: { attachments: true },
  })
  if (!session) {
    res.status(404).json({ error: 'Сессия не найдена' })
    return
  }
  await prisma.$transaction([
    prisma.generatedDocument.deleteMany({ where: { service_session_id: session.id } }),
    prisma.serviceRequest.deleteMany({ where: { service_session_id: session.id } }),
    prisma.serviceSession.delete({ where: { id: session.id } }),
  ])
  await Promise.all(session.attachments.map((attachment) => {
    const filePath = path.join(process.cwd(), attachment.url.replace('/uploads/', 'uploads/'))
    return fs.promises.unlink(filePath).catch(() => undefined)
  }))
  res.status(204).end()
})

router.get('/registry', requireAuth, requirePermission('office.view'), async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const [documents, requests, attachments] = await Promise.all([
    prisma.generatedDocument.findMany({
      where: search ? {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { registry_code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ],
      } : {},
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        service_session: { select: { id: true, number: true } },
      },
    }),
    prisma.serviceRequest.findMany({
      where: search ? {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { registry_code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ],
      } : {},
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        citizen: { select: { id: true, reg_number: true, nickname: true } },
        service_session: { select: { id: true, number: true } },
      },
    }),
    prisma.serviceAttachment.findMany({
      where: search ? {
        OR: [
          { original_name: { contains: search, mode: 'insensitive' } },
          { ocr_text: { contains: search, mode: 'insensitive' } },
          { session: { number: { contains: search, mode: 'insensitive' } } },
        ],
      } : {},
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        session: { select: { id: true, number: true, subject: true } },
        uploaded_by: { select: { id: true, login: true } },
      },
    }),
  ])
  res.json({ documents, requests, attachments })
})

router.get('/sessions/:id/offline-form.pdf', requireAuth, requirePermission('office.view'), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.id as string },
      include: { citizen: true, operator: { select: { login: true } } },
    })
    if (!session) {
      res.status(404).json({ error: 'Сессия не найдена' })
      return
    }
    const labels = ['Фамилия, имя / игровой ник', 'Discord', 'Предмет обращения', 'Содержание заявления', 'Перечень приложений', 'Дата', 'Подпись']
    const boxedLine = (count: number) => `<div class="boxes">${Array.from({ length: count }, () => '<i></i>').join('')}</div>`
    const rows = labels.map((label, index) => `
      <section class="field ${index === 3 || index === 4 ? 'is-large' : ''}">
        <strong>${label}</strong>
        ${index === 3 || index === 4 ? Array.from({ length: 5 }, () => boxedLine(42)).join('') : boxedLine(index === 2 ? 42 : 30)}
      </section>`).join('')
    const qr = qrCode(`SONAR|SESSION|${session.registry_code}|${session.id}`, 104)
    const barcode = barcodeStripes(session.registry_code, 360, 58)
    const header = `<div class="form-head"><div><b>СОНАР · ЦЕНТР ОБСЛУЖИВАНИЯ</b><h1>Лист офлайн-обслуживания</h1><p>${escapeHtml(session.number)} · ${escapeHtml(session.subject)}</p></div>${qr}</div>`
    const body = `<div class="instruction">Заполнять печатными заглавными буквами чёрной гелевой ручкой. Одна буква или цифра в одной клетке.</div>${rows}`
    const footer = `<div class="form-foot"><div>${barcode}<small>${escapeHtml(session.registry_code)}</small></div><div><b>Сотрудник</b><br>${escapeHtml(session.operator.login)}</div></div>`
    const styles = `
      .form-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:14px}.form-head b{font-size:10px;letter-spacing:2px}.form-head h1{margin:7px 0 4px;font:700 24px 'PT Serif',serif}.form-head p{margin:0;font:11px 'JetBrains Mono',monospace}
      .instruction{margin:16px 0;padding:10px 12px;border:1px solid #111;font-size:10px;line-height:1.5}.field{margin:14px 0;break-inside:avoid}.field strong{display:block;margin-bottom:6px;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.boxes{display:flex;margin-bottom:4px}.boxes i{width:16px;height:19px;border:1px solid #444;border-right:0}.boxes i:last-child{border-right:1px solid #444}.field.is-large .boxes i{height:18px}.form-foot{display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #111;padding-top:14px;font-size:11px}.form-foot small{display:block;margin-top:3px;font:9px 'JetBrains Mono',monospace}
    `
    const html = pageShell({ seed: session.registry_code, kind: 'offline-service', accent: INK, header, body, footer, styles })
    const pdf = await htmlToPdf(html)
    res.set(pdfHeaders(pdf, `${session.number}-offline-form.pdf`))
    res.send(pdf)
  } catch (error) {
    res.status(500).json(pdfError(error, 'offline service form'))
  }
})

export default router

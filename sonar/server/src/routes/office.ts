import { Router, Request, Response } from 'express'
import {
  Prisma,
  PrismaClient,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestType,
} from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { nextDocumentNumber, registryCode } from '../services/documentRegistry'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import {
  ACCENT,
  INK,
  barcodeStripes,
  escapeHtml,
  guillocheRosette,
  pageShell,
  sealBlock,
} from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

const REQUEST_TYPES = new Set(Object.values(ServiceRequestType))
const REQUEST_PRIORITIES = new Set(Object.values(ServiceRequestPriority))
const REQUEST_STATUSES = new Set(Object.values(ServiceRequestStatus))

const statusLabels: Record<ServiceRequestStatus, string> = {
  RECEIVED: 'Принято',
  REVIEW: 'На рассмотрении',
  IN_PROGRESS: 'В работе',
  WAITING: 'Ожидает сведений',
  COMPLETED: 'Исполнено',
  REJECTED: 'Отказано',
  CANCELLED: 'Отменено',
}

const typeLabels: Record<ServiceRequestType, string> = {
  APPLICATION: 'Заявление',
  COMPLAINT: 'Жалоба',
  PETITION: 'Ходатайство',
  SERVICE: 'Запрос услуги',
  INTERNAL: 'Служебное поручение',
}

const priorityLabels: Record<ServiceRequestPriority, string> = {
  LOW: 'Низкий',
  NORMAL: 'Обычный',
  HIGH: 'Высокий',
  URGENT: 'Срочный',
}

const includeRequest = {
  citizen: { select: { id: true, nickname: true, reg_number: true } },
  assignee: { select: { id: true, login: true } },
  created_by: { select: { id: true, login: true } },
  events: {
    orderBy: { created_at: 'desc' as const },
    include: { created_by: { select: { id: true, login: true } } },
  },
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

router.get('/', requireAuth, requirePermission('office.view'), async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const status = typeof req.query.status === 'string' && REQUEST_STATUSES.has(req.query.status as ServiceRequestStatus)
      ? req.query.status as ServiceRequestStatus
      : undefined
    const type = typeof req.query.type === 'string' && REQUEST_TYPES.has(req.query.type as ServiceRequestType)
      ? req.query.type as ServiceRequestType
      : undefined
    const priority = typeof req.query.priority === 'string' && REQUEST_PRIORITIES.has(req.query.priority as ServiceRequestPriority)
      ? req.query.priority as ServiceRequestPriority
      : undefined
    const mine = req.query.mine === 'true'

    const where: Prisma.ServiceRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
      ...(mine ? { assignee_id: req.user!.id } : {}),
      ...(search ? {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { registry_code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { citizen: { nickname: { contains: search, mode: 'insensitive' } } },
          { assignee: { login: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    }

    const requests = await prisma.serviceRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { due_at: 'asc' }, { created_at: 'desc' }],
      include: includeRequest,
    })
    res.json(requests)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось загрузить обращения' })
  }
})

router.get('/stats', requireAuth, requirePermission('office.view'), async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const [total, active, overdue, urgent, completedToday] = await Promise.all([
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({
        where: { status: { in: ['RECEIVED', 'REVIEW', 'IN_PROGRESS', 'WAITING'] } },
      }),
      prisma.serviceRequest.count({
        where: {
          status: { in: ['RECEIVED', 'REVIEW', 'IN_PROGRESS', 'WAITING'] },
          due_at: { lt: now },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          status: { in: ['RECEIVED', 'REVIEW', 'IN_PROGRESS', 'WAITING'] },
          priority: 'URGENT',
        },
      }),
      prisma.serviceRequest.count({
        where: {
          status: 'COMPLETED',
          resolved_at: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        },
      }),
    ])
    res.json({ total, active, overdue, urgent, completed_today: completedToday })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось получить сводку обращений' })
  }
})

router.get('/staff', requireAuth, requirePermission('office.view'), async (_req: Request, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: { is_active: true },
      orderBy: { login: 'asc' },
      select: {
        id: true,
        login: true,
        role: { select: { name: true } },
      },
    })
    res.json(staff)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось загрузить сотрудников' })
  }
})

router.post('/', requireAuth, requirePermission('office.create'), async (req: Request, res: Response) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : ''
    const type = REQUEST_TYPES.has(req.body.type) ? req.body.type as ServiceRequestType : null
    const priority = REQUEST_PRIORITIES.has(req.body.priority)
      ? req.body.priority as ServiceRequestPriority
      : ServiceRequestPriority.NORMAL
    const dueAt = parseDate(req.body.due_at)

    if (!title || !description || !type) {
      res.status(400).json({ error: 'Укажите тип, тему и содержание обращения' })
      return
    }
    if (req.body.due_at && dueAt === undefined) {
      res.status(400).json({ error: 'Некорректный срок исполнения' })
      return
    }

    const citizenId = typeof req.body.citizen_id === 'string' && req.body.citizen_id
      ? req.body.citizen_id
      : null
    const assigneeId = typeof req.body.assignee_id === 'string' && req.body.assignee_id
      ? req.body.assignee_id
      : null

    const request = await prisma.$transaction(async (tx) => {
      if (citizenId) {
        const citizen = await tx.citizen.findUnique({ where: { id: citizenId }, select: { id: true } })
        if (!citizen) throw new Error('CITIZEN_NOT_FOUND')
      }
      if (assigneeId) {
        const assignee = await tx.user.findFirst({ where: { id: assigneeId, is_active: true }, select: { id: true } })
        if (!assignee) throw new Error('ASSIGNEE_NOT_FOUND')
      }

      const number = await nextDocumentNumber(tx, 'OFFICE', 'ОБР')
      return tx.serviceRequest.create({
        data: {
          number,
          registry_code: registryCode('ОБР', number),
          type,
          title: title.slice(0, 180),
          description: description.slice(0, 8000),
          contact: typeof req.body.contact === 'string' ? req.body.contact.trim().slice(0, 240) || null : null,
          priority,
          citizen_id: citizenId,
          assignee_id: assigneeId,
          created_by_id: req.user!.id,
          linked_entity_type: typeof req.body.linked_entity_type === 'string' ? req.body.linked_entity_type : null,
          linked_entity_id: typeof req.body.linked_entity_id === 'string' ? req.body.linked_entity_id : null,
          due_at: dueAt,
          events: {
            create: {
              type: 'CREATED',
              message: 'Обращение зарегистрировано в СОНАР',
              to_status: ServiceRequestStatus.RECEIVED,
              created_by_id: req.user!.id,
            },
          },
        },
        include: includeRequest,
      })
    })

    res.status(201).json(request)
  } catch (error) {
    if (error instanceof Error && error.message === 'CITIZEN_NOT_FOUND') {
      res.status(404).json({ error: 'Гражданин не найден' })
      return
    }
    if (error instanceof Error && error.message === 'ASSIGNEE_NOT_FOUND') {
      res.status(404).json({ error: 'Ответственный сотрудник не найден' })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Не удалось зарегистрировать обращение' })
  }
})

router.get('/:id', requireAuth, requirePermission('office.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const request = await prisma.serviceRequest.findFirst({
      where: { OR: [{ id }, { number: id }, { registry_code: id }] },
      include: includeRequest,
    })
    if (!request) {
      res.status(404).json({ error: 'Обращение не найдено' })
      return
    }
    res.json(request)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось загрузить обращение' })
  }
})

router.patch('/:id', requireAuth, requirePermission('office.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.serviceRequest.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Обращение не найдено' })
      return
    }

    const nextStatus = req.body.status && REQUEST_STATUSES.has(req.body.status)
      ? req.body.status as ServiceRequestStatus
      : existing.status
    const nextPriority = req.body.priority && REQUEST_PRIORITIES.has(req.body.priority)
      ? req.body.priority as ServiceRequestPriority
      : existing.priority
    const dueAt = req.body.due_at !== undefined ? parseDate(req.body.due_at) : existing.due_at
    if (req.body.due_at !== undefined && dueAt === undefined) {
      res.status(400).json({ error: 'Некорректный срок исполнения' })
      return
    }

    const assigneeId = req.body.assignee_id === null || req.body.assignee_id === ''
      ? null
      : typeof req.body.assignee_id === 'string'
        ? req.body.assignee_id
        : existing.assignee_id
    if (assigneeId) {
      const assignee = await prisma.user.findFirst({ where: { id: assigneeId, is_active: true }, select: { id: true } })
      if (!assignee) {
        res.status(404).json({ error: 'Ответственный сотрудник не найден' })
        return
      }
    }

    const resolution = typeof req.body.resolution === 'string'
      ? req.body.resolution.trim().slice(0, 8000) || null
      : existing.resolution
    const isTerminal = ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(nextStatus)
    if (isTerminal && nextStatus !== 'CANCELLED' && !resolution) {
      res.status(400).json({ error: 'Для завершения укажите резолюцию или причину отказа' })
      return
    }

    const request = await prisma.$transaction(async (tx) => {
      const statusChanged = existing.status !== nextStatus
      const assigneeChanged = existing.assignee_id !== assigneeId
      const priorityChanged = existing.priority !== nextPriority
      const changes: string[] = []
      if (statusChanged) changes.push(`Статус: ${statusLabels[existing.status]} → ${statusLabels[nextStatus]}`)
      if (assigneeChanged) changes.push(assigneeId ? 'Назначен ответственный сотрудник' : 'Ответственный снят')
      if (priorityChanged) changes.push(`Приоритет: ${priorityLabels[existing.priority]} → ${priorityLabels[nextPriority]}`)
      if (req.body.due_at !== undefined) changes.push('Изменён срок исполнения')
      if (req.body.resolution !== undefined) changes.push('Обновлена резолюция')

      return tx.serviceRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          priority: nextPriority,
          assignee_id: assigneeId,
          due_at: dueAt,
          resolution,
          resolved_at: isTerminal ? existing.resolved_at ?? new Date() : null,
          ...(changes.length > 0 ? {
            events: {
              create: {
                type: statusChanged ? 'STATUS_CHANGED' : 'UPDATED',
                message: changes.join('. '),
                from_status: statusChanged ? existing.status : null,
                to_status: statusChanged ? nextStatus : null,
                created_by_id: req.user!.id,
              },
            },
          } : {}),
        },
        include: includeRequest,
      })
    })
    res.json(request)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось обновить обращение' })
  }
})

router.post('/:id/events', requireAuth, requirePermission('office.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : ''
    if (!message) {
      res.status(400).json({ error: 'Введите текст служебной отметки' })
      return
    }
    const request = await prisma.serviceRequest.findUnique({ where: { id }, select: { id: true } })
    if (!request) {
      res.status(404).json({ error: 'Обращение не найдено' })
      return
    }
    const event = await prisma.serviceRequestEvent.create({
      data: {
        request_id: id,
        type: 'NOTE',
        message: message.slice(0, 2000),
        created_by_id: req.user!.id,
      },
      include: { created_by: { select: { id: true, login: true } } },
    })
    res.status(201).json(event)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось добавить отметку' })
  }
})

router.get('/:id/pdf', requireAuth, requirePermission('office.view'), async (req: Request, res: Response) => {
  try {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id as string },
      include: includeRequest,
    })
    if (!request) {
      res.status(404).json({ error: 'Обращение не найдено' })
      return
    }

    const createdDate = request.created_at.toLocaleDateString('ru-RU')
    const barcode = barcodeStripes(request.registry_code, 320, 44)
    const rosette = guillocheRosette(request.registry_code, 86)
    const seal = sealBlock({
      number: request.number,
      signer: request.assignee?.login ?? request.created_by.login,
      role: request.assignee ? 'Ответственный исполнитель' : 'Регистратор',
      date: createdDate,
      size: 118,
    })
    const events = request.events.slice().reverse().map((event) => `
      <tr>
        <td>${escapeHtml(event.created_at.toLocaleString('ru-RU'))}</td>
        <td>${escapeHtml(event.created_by.login)}</td>
        <td>${escapeHtml(event.message)}</td>
      </tr>
    `).join('')
    const field = (label: string, value: unknown) => `
      <div class="office-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? '—')}</strong></div>
    `

    const header = `<div class="office-header">
      <div class="office-emblem">${rosette}</div>
      <div>
        <div class="office-state">ГОСУДАРСТВО ПЕЛЬГАРИЯ · СОНАР</div>
        <div class="office-title">КАРТОЧКА ОБРАЩЕНИЯ</div>
        <div class="office-number">№ ${escapeHtml(request.number)} · ${escapeHtml(request.registry_code)}</div>
      </div>
    </div>`
    const body = `
      <div class="office-banner">
        <div><span>Тип</span><strong>${escapeHtml(typeLabels[request.type])}</strong></div>
        <div><span>Статус</span><strong>${escapeHtml(statusLabels[request.status])}</strong></div>
        <div><span>Приоритет</span><strong>${escapeHtml(priorityLabels[request.priority])}</strong></div>
      </div>
      <h1>${escapeHtml(request.title)}</h1>
      <div class="office-grid">
        ${field('Заявитель', request.citizen ? `${request.citizen.nickname} · ${request.citizen.reg_number}` : 'Не указан')}
        ${field('Контакт', request.contact)}
        ${field('Ответственный', request.assignee?.login ?? 'Не назначен')}
        ${field('Срок исполнения', request.due_at?.toLocaleDateString('ru-RU') ?? 'Не установлен')}
        ${field('Дата регистрации', request.created_at.toLocaleString('ru-RU'))}
        ${field('Регистратор', request.created_by.login)}
      </div>
      <section><h2>Содержание обращения</h2><p>${escapeHtml(request.description)}</p></section>
      ${request.resolution ? `<section class="resolution"><h2>Резолюция</h2><p>${escapeHtml(request.resolution)}</p></section>` : ''}
      <section><h2>Журнал исполнения</h2>
        <table><thead><tr><th>Дата</th><th>Сотрудник</th><th>Событие</th></tr></thead><tbody>${events}</tbody></table>
      </section>
    `
    const footer = `<div class="office-footer"><div>${barcode}<div>${escapeHtml(request.registry_code)}</div></div>${seal}</div>`
    const styles = `
      .office-header{display:flex;align-items:center;gap:18px;border-bottom:3px solid ${INK};padding-bottom:16px}
      .office-emblem{width:72px;height:72px}.office-emblem svg{width:72px;height:72px}
      .office-state{font-size:10px;letter-spacing:3px;font-weight:700;color:${ACCENT}}
      .office-title{font-family:'PT Serif',serif;font-size:25px;font-weight:700;margin-top:5px}
      .office-number{font-family:'JetBrains Mono',monospace;font-size:11px;margin-top:5px}
      .office-banner{display:grid;grid-template-columns:repeat(3,1fr);margin:18px 0;border:1px solid #111}
      .office-banner div{padding:10px 12px;border-right:1px solid #111}.office-banner div:last-child{border-right:0}
      .office-banner span,.office-field span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#666}
      .office-banner strong{display:block;margin-top:4px;font-size:13px}
      h1{font-family:'PT Serif',serif;font-size:24px;margin:20px 0 14px}
      .office-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #bbb;border-left:1px solid #bbb}
      .office-field{padding:10px 12px;border-right:1px solid #bbb;border-bottom:1px solid #bbb}
      .office-field strong{display:block;margin-top:4px;font-size:13px}
      section{margin-top:22px}section h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #111;padding-bottom:6px}
      section p{font-size:13px;line-height:1.65;white-space:pre-wrap;margin-top:10px}
      .resolution{border:1px solid #111;padding:12px}.resolution h2{border-bottom:1px solid #777;margin-top:0}
      table{width:100%;border-collapse:collapse;margin-top:8px}th{font-size:9px;text-align:left;text-transform:uppercase;color:#666;border-bottom:2px solid #111;padding:6px}
      td{font-size:10px;vertical-align:top;border-bottom:1px solid #ddd;padding:7px 6px}
      .office-footer{display:flex;align-items:flex-end;justify-content:space-between;border-top:2px solid #111;padding-top:16px;margin-top:24px}
      .office-footer>div:first-child{font-family:'JetBrains Mono',monospace;font-size:9px}
    `
    const html = pageShell({
      seed: request.registry_code,
      kind: 'office-request',
      accent: ACCENT,
      header,
      body,
      footer,
      styles,
      watermark: `<div style="width:500px;height:500px">${guillocheRosette(`${request.registry_code}:wm`, 500)}</div>`,
    })
    const pdf = await htmlToPdf(html)
    res.set(pdfHeaders(pdf, `request-${request.number}.pdf`))
    res.send(pdf)
  } catch (error) {
    res.status(500).json(pdfError(error, 'service request'))
  }
})

export default router

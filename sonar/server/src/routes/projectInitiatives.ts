import { Router, Request, Response } from 'express'
import {
  InitiativeStatus,
  InitiativeType,
  Prisma,
  PrismaClient,
} from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { isSuperadmin, requirePermission, requireSuperadmin } from '../middleware/permissions'
import { registryCode } from '../services/documentRegistry'
import { htmlToPdf, pdfError, pdfHeaders } from '../services/pdf'
import {
  A4_W,
  ACCENT,
  INK,
  barcodeStripes,
  escapeHtml,
  guillocheRosette,
  microtextLine,
  pageShell,
  sealBlock,
} from '../services/templates'

const router = Router()
const prisma = new PrismaClient()

type DbTx = Prisma.TransactionClient

const TYPES = new Set(Object.values(InitiativeType))
const STATUSES = new Set(Object.values(InitiativeStatus))

// Право Совета (решение) — Председатель Верховного Совета (суперадмин) проходит всегда.
const DECISION_STATUSES = new Set<InitiativeStatus>([
  InitiativeStatus.ACCEPTED,
  InitiativeStatus.REJECTED,
  InitiativeStatus.REVISION,
  InitiativeStatus.IMPLEMENTED,
  InitiativeStatus.ARCHIVED,
])

const TYPE_LABELS: Record<InitiativeType, string> = {
  BUILDING: 'Здание',
  ORGANIZATION: 'Организация',
  DEPARTMENT: 'Ведомство',
  COMPANY: 'Компания',
  LAW: 'Закон',
  CAMPAIGN: 'Акция',
  DEVELOPMENT: 'Направление развития',
  POLICY: 'Политика',
  OTHER: 'Иное',
}

const STATUS_LABELS: Record<InitiativeStatus, string> = {
  SUBMITTED: 'Подана',
  UNDER_REVIEW: 'На рассмотрении',
  ACCEPTED: 'Принята',
  REJECTED: 'Отклонена',
  REVISION: 'На доработке',
  IMPLEMENTED: 'Реализована',
  ARCHIVED: 'Архив',
}

const includeInitiative = {
  created_by: { select: { id: true, login: true } },
  events: {
    orderBy: { created_at: 'desc' as const },
    include: { created_by: { select: { id: true, login: true } } },
  },
}

function canDecide(req: Request): boolean {
  return isSuperadmin(req) || req.user?.permissions?.['initiatives.decide'] === true
}

// Регистрационный номер СОНАР: префикс + год + сквозной порядковый (ПИ-2026-0001).
async function nextInitiativeNumber(tx: DbTx, date = new Date()): Promise<string> {
  const year = date.getFullYear()
  const key = `INITIATIVE:${year}`
  const sequence = await tx.documentSequence.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  })
  return `ПИ-${year}-${String(sequence.value).padStart(4, '0')}`
}

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

router.get('/', requireAuth, requirePermission('initiatives.view'), async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const status = typeof req.query.status === 'string' && STATUSES.has(req.query.status as InitiativeStatus)
      ? req.query.status as InitiativeStatus
      : undefined
    const type = typeof req.query.type === 'string' && TYPES.has(req.query.type as InitiativeType)
      ? req.query.type as InitiativeType
      : undefined

    const where: Prisma.ProjectInitiativeWhereInput = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search ? {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { registry_code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { initiator: { contains: search, mode: 'insensitive' } },
          { essence: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    }

    const initiatives = await prisma.projectInitiative.findMany({
      where,
      orderBy: [{ status: 'asc' }, { submitted_at: 'desc' }],
      include: includeInitiative,
    })
    res.json(initiatives)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось загрузить реестр инициатив' })
  }
})

router.get('/stats', requireAuth, requirePermission('initiatives.view'), async (_req: Request, res: Response) => {
  try {
    const [total, review, accepted, revision] = await Promise.all([
      prisma.projectInitiative.count(),
      prisma.projectInitiative.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      prisma.projectInitiative.count({ where: { status: { in: ['ACCEPTED', 'IMPLEMENTED'] } } }),
      prisma.projectInitiative.count({ where: { status: 'REVISION' } }),
    ])
    res.json({ total, review, accepted, revision })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось получить сводку инициатив' })
  }
})

router.post('/', requireAuth, requirePermission('initiatives.create'), async (req: Request, res: Response) => {
  try {
    const type = TYPES.has(req.body.type) ? req.body.type as InitiativeType : null
    const title = cleanString(req.body.title, 180)
    const initiator = cleanString(req.body.initiator, 180)
    const essence = cleanString(req.body.essence, 8000)
    const stateRequest = cleanString(req.body.state_request, 8000)
    const responsible = cleanString(req.body.responsible, 180) || null

    if (!type || !title || !initiator || !essence || !stateRequest) {
      res.status(400).json({ error: 'Заполните тип, название, инициатора, суть и что требуется от государства' })
      return
    }

    const initiative = await prisma.$transaction(async (tx) => {
      const number = await nextInitiativeNumber(tx)
      return tx.projectInitiative.create({
        data: {
          number,
          registry_code: registryCode('ПИ', number),
          type,
          title,
          initiator,
          essence,
          state_request: stateRequest,
          responsible,
          created_by_id: req.user!.id,
          events: {
            create: {
              type: 'CREATED',
              message: 'Инициатива зарегистрирована в реестре СОНАР Канцелярией Верховного Совета',
              to_status: InitiativeStatus.SUBMITTED,
              created_by_id: req.user!.id,
            },
          },
        },
        include: includeInitiative,
      })
    })

    res.status(201).json(initiative)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось зарегистрировать инициативу' })
  }
})

router.get('/:id', requireAuth, requirePermission('initiatives.view'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const initiative = await prisma.projectInitiative.findFirst({
      where: { OR: [{ id }, { number: id }, { registry_code: id }] },
      include: includeInitiative,
    })
    if (!initiative) {
      res.status(404).json({ error: 'Инициатива не найдена' })
      return
    }
    res.json(initiative)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось загрузить инициативу' })
  }
})

// Редактирование регистрационных полей и статуса делопроизводства — Канцелярия (initiatives.manage).
// Перевод в статусы решения (принята/отклонена/на доработке/реализована/архив) и блок решения —
// только Совет (initiatives.decide) или Председатель Верховного Совета (суперадмин).
router.patch('/:id', requireAuth, requirePermission('initiatives.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.projectInitiative.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Инициатива не найдена' })
      return
    }

    const nextStatus = req.body.status && STATUSES.has(req.body.status)
      ? req.body.status as InitiativeStatus
      : existing.status

    const isDecision = nextStatus !== existing.status && DECISION_STATUSES.has(nextStatus)
    if (isDecision && !canDecide(req)) {
      res.status(403).json({ error: 'Решение принимает Совет: требуется право initiatives.decide' })
      return
    }

    const decisionNote = req.body.decision_note !== undefined
      ? (cleanString(req.body.decision_note, 8000) || null)
      : existing.decision_note
    if (isDecision && (nextStatus === InitiativeStatus.REJECTED || nextStatus === InitiativeStatus.REVISION) && !decisionNote) {
      res.status(400).json({ error: 'Для отклонения или доработки укажите основание решения' })
      return
    }

    const responsible = req.body.responsible !== undefined
      ? (cleanString(req.body.responsible, 180) || null)
      : existing.responsible
    const title = req.body.title !== undefined ? cleanString(req.body.title, 180) || existing.title : existing.title
    const essence = req.body.essence !== undefined ? cleanString(req.body.essence, 8000) || existing.essence : existing.essence
    const stateRequest = req.body.state_request !== undefined
      ? cleanString(req.body.state_request, 8000) || existing.state_request
      : existing.state_request
    const type = req.body.type && TYPES.has(req.body.type) ? req.body.type as InitiativeType : existing.type

    const initiative = await prisma.$transaction(async (tx) => {
      const statusChanged = existing.status !== nextStatus
      const changes: string[] = []
      if (statusChanged) changes.push(`Статус: ${STATUS_LABELS[existing.status]} → ${STATUS_LABELS[nextStatus]}`)
      if (req.body.responsible !== undefined && existing.responsible !== responsible) {
        changes.push(responsible ? `Ответственный: ${responsible}` : 'Ответственный снят')
      }
      if (req.body.type !== undefined && existing.type !== type) changes.push(`Тип: ${TYPE_LABELS[type]}`)
      if (req.body.title !== undefined && existing.title !== title) changes.push('Уточнено название')
      if (req.body.essence !== undefined && existing.essence !== essence) changes.push('Обновлена суть')
      if (req.body.state_request !== undefined && existing.state_request !== stateRequest) changes.push('Обновлён запрос к государству')
      if (isDecision && req.body.decision_note !== undefined) changes.push('Внесена резолюция Совета')

      return tx.projectInitiative.update({
        where: { id },
        data: {
          status: nextStatus,
          type,
          title,
          essence,
          state_request: stateRequest,
          responsible,
          decision_note: decisionNote,
          ...(isDecision ? {
            decided_by_login: req.user!.login,
            decided_at: existing.decided_at ?? new Date(),
          } : {}),
          ...(changes.length > 0 ? {
            events: {
              create: {
                type: isDecision ? 'DECISION' : (statusChanged ? 'STATUS_CHANGED' : 'UPDATED'),
                message: changes.join('. '),
                from_status: statusChanged ? existing.status : null,
                to_status: statusChanged ? nextStatus : null,
                created_by_id: req.user!.id,
              },
            },
          } : {}),
        },
        include: includeInitiative,
      })
    })
    res.json(initiative)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось обновить инициативу' })
  }
})

router.post('/:id/events', requireAuth, requirePermission('initiatives.manage'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const message = cleanString(req.body.message, 2000)
    if (!message) {
      res.status(400).json({ error: 'Введите текст служебной отметки' })
      return
    }
    const initiative = await prisma.projectInitiative.findUnique({ where: { id }, select: { id: true } })
    if (!initiative) {
      res.status(404).json({ error: 'Инициатива не найдена' })
      return
    }
    const event = await prisma.projectInitiativeEvent.create({
      data: { initiative_id: id, type: 'NOTE', message, created_by_id: req.user!.id },
      include: { created_by: { select: { id: true, login: true } } },
    })
    res.status(201).json(event)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось добавить отметку' })
  }
})

// Удаление записи реестра — только Председатель Верховного Совета (суперадмин).
router.delete('/:id', requireAuth, requireSuperadmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const initiative = await prisma.projectInitiative.findUnique({ where: { id }, select: { id: true } })
    if (!initiative) {
      res.status(404).json({ error: 'Инициатива не найдена' })
      return
    }
    await prisma.projectInitiative.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Не удалось удалить инициативу' })
  }
})

router.get('/:id/pdf', requireAuth, requirePermission('initiatives.view'), async (req: Request, res: Response) => {
  try {
    const initiative = await prisma.projectInitiative.findUnique({
      where: { id: req.params.id as string },
      include: includeInitiative,
    })
    if (!initiative) {
      res.status(404).json({ error: 'Инициатива не найдена' })
      return
    }

    const submitted = initiative.submitted_at.toLocaleDateString('ru-RU')
    const rosette = guillocheRosette(initiative.registry_code, 78)
    const barcode = barcodeStripes(initiative.registry_code, 320, 44)
    const micro = microtextLine('ПЕЛЬГРАД · СОНАР · КАНЦЕЛЯРИЯ ВЕРХОВНОГО СОВЕТА · ПРОЕКТНАЯ ИНИЦИАТИВА · ', A4_W - 96, 9)
    const decided = initiative.decided_at
      ? initiative.decided_at.toLocaleDateString('ru-RU')
      : null
    const seal = sealBlock({
      number: initiative.number,
      signer: initiative.decided_by_login ?? initiative.created_by.login,
      role: initiative.decided_by_login ? 'Председатель Верховного Совета' : 'Канцелярия Верховного Совета',
      date: decided ?? submitted,
      size: 118,
    })

    const field = (label: string, value: unknown) =>
      `<div class="pi-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? '—')}</strong></div>`

    const header = `<div class="pi-header">
      <div class="pi-emblem">${rosette}</div>
      <div>
        <div class="pi-state">ГОСУДАРСТВО ПЕЛЬГРАД · СОНАР</div>
        <div class="pi-title">ПРОЕКТНАЯ ИНИЦИАТИВА</div>
        <div class="pi-org">Канцелярия Верховного Совета</div>
        <div class="pi-number">Рег. № ${escapeHtml(initiative.number)} · ${escapeHtml(initiative.registry_code)}</div>
      </div>
    </div>
    <div class="pi-micro">${micro}</div>`

    const decisionBlock = `
      <section class="pi-decision">
        <h2>Решение</h2>
        <div class="pi-decision-grid">
          <div class="pi-field"><span>Итог</span><strong>${escapeHtml(STATUS_LABELS[initiative.status])}</strong></div>
          <div class="pi-field"><span>Подпись</span><strong>${escapeHtml(initiative.decided_by_login ?? 'Не подписано')}</strong></div>
          <div class="pi-field"><span>Дата решения</span><strong>${escapeHtml(decided ?? 'Не вынесено')}</strong></div>
        </div>
        ${initiative.decision_note ? `<p>${escapeHtml(initiative.decision_note)}</p>` : ''}
      </section>`

    const body = `
      <div class="pi-banner">
        <div><span>Тип проекта</span><strong>${escapeHtml(TYPE_LABELS[initiative.type])}</strong></div>
        <div><span>Статус</span><strong>${escapeHtml(STATUS_LABELS[initiative.status])}</strong></div>
        <div><span>Дата подачи</span><strong>${escapeHtml(submitted)}</strong></div>
      </div>
      <h1>${escapeHtml(initiative.title)}</h1>
      <div class="pi-grid">
        ${field('Инициатор', initiative.initiator)}
        ${field('Ответственный', initiative.responsible ?? 'Не назначен')}
        ${field('Зарегистрировал', initiative.created_by.login)}
        ${field('Регистрация в СОНАР', initiative.created_at.toLocaleString('ru-RU'))}
      </div>
      <section><h2>Суть инициативы</h2><p>${escapeHtml(initiative.essence)}</p></section>
      <section><h2>Что требуется от государства</h2><p>${escapeHtml(initiative.state_request)}</p></section>
      ${decisionBlock}`

    const footer = `<div class="pi-footer">
      <div class="pi-footer-code">${barcode}<div>${escapeHtml(initiative.registry_code)}</div></div>
      ${seal}
    </div>
    <div class="pi-force">Документ действителен только при наличии регистрации в реестре СОНАР (рег. № и контрольный ШК). Решение по инициативе вступает в силу после подписи уполномоченного лица Канцелярии или Верховного Совета.</div>`

    const styles = `
      *{color:#000 !important}
      .pi-header{display:flex;align-items:center;gap:18px;border-bottom:3px solid ${INK};padding-bottom:14px}
      .pi-emblem{width:72px;height:72px}.pi-emblem svg{width:72px;height:72px;filter:grayscale(1) contrast(1.4)}
      .pi-state{font-size:10px;letter-spacing:3px;font-weight:700;color:${ACCENT}}
      .pi-title{font-family:'PT Serif',serif;font-size:25px;font-weight:700;margin-top:5px}
      .pi-org{font-size:11px;margin-top:3px;letter-spacing:.04em}
      .pi-number{font-family:'JetBrains Mono',monospace;font-size:11px;margin-top:5px}
      .pi-micro{margin:6px 0 0;height:9px;overflow:hidden;opacity:.7}
      .pi-micro svg{width:100%}
      .pi-banner{display:grid;grid-template-columns:repeat(3,1fr);margin:18px 0;border:1px solid #000}
      .pi-banner div{padding:10px 12px;border-right:1px solid #000}.pi-banner div:last-child{border-right:0}
      .pi-banner span,.pi-field span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#444}
      .pi-banner strong{display:block;margin-top:4px;font-size:13px}
      h1{font-family:'PT Serif',serif;font-size:24px;margin:18px 0 14px}
      .pi-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;border-left:1px solid #000}
      .pi-field{padding:10px 12px;border-right:1px solid #000;border-bottom:1px solid #000}
      .pi-field strong{display:block;margin-top:4px;font-size:13px}
      section{margin-top:20px}
      section h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #000;padding-bottom:6px}
      section p{font-size:13px;line-height:1.65;white-space:pre-wrap;margin-top:10px}
      .pi-decision{border:2px solid #000;padding:14px;margin-top:22px}
      .pi-decision h2{border:0;padding:0;margin-bottom:10px}
      .pi-decision-grid{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #000;border-left:1px solid #000}
      .pi-decision-grid .pi-field{border-right:1px solid #000;border-bottom:1px solid #000}
      .pi-footer{display:flex;align-items:flex-end;justify-content:space-between;border-top:2px solid #000;padding-top:16px;margin-top:24px}
      .pi-footer-code{font-family:'JetBrains Mono',monospace;font-size:9px}
      .pi-footer-code svg{filter:grayscale(1) contrast(2);shape-rendering:crispEdges}
      .pi-force{margin-top:14px;padding-top:10px;border-top:1px solid #000;font-size:9px;line-height:1.5;color:#000}
      @media print{*{color:#000 !important}}
    `

    const html = pageShell({
      seed: initiative.registry_code,
      kind: 'project-initiative',
      accent: INK,
      header,
      body,
      footer,
      styles,
      watermark: `<div style="width:500px;height:500px">${guillocheRosette(`${initiative.registry_code}:wm`, 500)}</div>`,
    })
    const pdf = await htmlToPdf(html)
    res.set(pdfHeaders(pdf, `initiative-${initiative.number}.pdf`))
    res.send(pdf)
  } catch (error) {
    res.status(500).json(pdfError(error, 'project initiative'))
  }
})

export default router

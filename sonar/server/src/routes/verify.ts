import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

export interface VerifyResult {
  found: boolean
  kind?: string
  kind_label?: string
  number?: string
  registry_code?: string | null
  title?: string
  subject?: string | null
  status?: string | null
  status_label?: string | null
  issued_at?: string | null
  link?: string | null
  fields?: { label: string; value: string }[]
}

const PASSPORT_STATUS: Record<string, string> = { VALID: 'Действителен', REVOKED: 'Аннулирован', EXPIRED: 'Просрочен' }
const CASE_STATUS: Record<string, string> = { OPENED: 'Открыто', IN_PROGRESS: 'В производстве', CLOSED: 'Закрыто' }
const LAW_STATUS: Record<string, string> = { ACTIVE: 'Действует', REPEALED: 'Отменён', SUSPENDED: 'Приостановлен' }
const PUNISH_STATUS: Record<string, string> = { ACTIVE: 'Активно', REVOKED: 'Снято', EXPIRED: 'Истекло' }
const TREATY_STATUS: Record<string, string> = { ACTIVE: 'Действует', TERMINATED: 'Расторгнут' }

// GET /api/verify/:code — проверка подлинности документа по номеру или ШК.
// Доступно только авторизованным сотрудникам СОНАР.
router.get('/:code', requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = (req.params.code as string).trim()
    if (!raw || raw.length < 3) {
      res.status(400).json({ error: 'Введите номер или ШК документа' })
      return
    }
    const q = { equals: raw, mode: 'insensitive' as const }
    const match = { OR: [{ number: q }, { registry_code: q }] }

    // Passport
    const passport = await prisma.passport.findFirst({
      where: match,
      include: { citizen: { select: { nickname: true, reg_number: true } } },
    })
    if (passport) {
      res.json(<VerifyResult>{
        found: true,
        kind: 'PASSPORT',
        kind_label: 'Паспорт гражданина',
        number: passport.number,
        registry_code: passport.registry_code,
        title: 'Паспорт',
        subject: passport.citizen?.nickname ?? null,
        status: passport.status,
        status_label: PASSPORT_STATUS[passport.status] ?? passport.status,
        issued_at: passport.issued_at.toISOString(),
        link: '/passports',
        fields: [
          { label: 'Владелец', value: passport.citizen?.nickname ?? '—' },
          { label: 'Рег. номер', value: passport.citizen?.reg_number ?? '—' },
        ],
      })
      return
    }

    // Law
    const law = await prisma.law.findFirst({ where: match })
    if (law) {
      res.json(<VerifyResult>{
        found: true,
        kind: 'LAW',
        kind_label: 'Нормативный правовой акт',
        number: law.number,
        registry_code: law.registry_code,
        title: law.title,
        status: law.status,
        status_label: LAW_STATUS[law.status] ?? law.status,
        issued_at: law.adopted_at.toISOString(),
        link: `/laws/${law.id}`,
        fields: [{ label: 'Категория', value: law.category ?? '—' }],
      })
      return
    }

    // Case
    const legalCase = await prisma.case.findFirst({
      where: match,
      include: { accused: { select: { nickname: true } } },
    })
    if (legalCase) {
      res.json(<VerifyResult>{
        found: true,
        kind: 'CASE',
        kind_label: 'Судебное дело',
        number: legalCase.number,
        registry_code: legalCase.registry_code,
        title: 'Дело',
        subject: legalCase.accused?.nickname ?? null,
        status: legalCase.status,
        status_label: CASE_STATUS[legalCase.status] ?? legalCase.status,
        issued_at: legalCase.opened_at.toISOString(),
        link: `/cases/${legalCase.id}`,
        fields: [{ label: 'Обвиняемый', value: legalCase.accused?.nickname ?? '—' }],
      })
      return
    }

    // Punishment
    const punishment = await prisma.punishment.findFirst({
      where: match,
      include: { citizen: { select: { nickname: true } } },
    })
    if (punishment) {
      res.json(<VerifyResult>{
        found: true,
        kind: 'PUNISHMENT',
        kind_label: 'Наказание',
        number: punishment.number ?? '—',
        registry_code: punishment.registry_code,
        title: 'Постановление о наказании',
        subject: punishment.citizen?.nickname ?? null,
        status: punishment.status,
        status_label: PUNISH_STATUS[punishment.status] ?? punishment.status,
        issued_at: punishment.issued_at.toISOString(),
        link: '/punishments',
        fields: [{ label: 'Гражданин', value: punishment.citizen?.nickname ?? '—' }],
      })
      return
    }

    // Treaty
    const treaty = await prisma.diplomaticTreaty.findFirst({
      where: match,
      include: { state: { select: { name: true } } },
    })
    if (treaty) {
      res.json(<VerifyResult>{
        found: true,
        kind: 'TREATY',
        kind_label: 'Дипломатический договор',
        number: treaty.number,
        registry_code: treaty.registry_code,
        title: 'Договор',
        subject: treaty.state?.name ?? null,
        status: treaty.status,
        status_label: TREATY_STATUS[treaty.status] ?? treaty.status,
        issued_at: treaty.signed_at.toISOString(),
        link: '/diplomacy',
        fields: [{ label: 'Сторона', value: treaty.state?.name ?? '—' }],
      })
      return
    }

    // Generated document (print center)
    const doc = await prisma.generatedDocument.findFirst({
      where: match,
      include: { citizen: { select: { nickname: true } } },
    })
    if (doc) {
      res.json(<VerifyResult>{
        found: true,
        kind: 'DOCUMENT',
        kind_label: 'Печатная форма СОНАР',
        number: doc.number,
        registry_code: doc.registry_code,
        title: doc.title,
        subject: doc.citizen?.nickname ?? null,
        status: doc.status,
        status_label: doc.status === 'READY' ? 'Действителен' : doc.status,
        issued_at: doc.created_at.toISOString(),
        link: '/print-center',
        fields: [{ label: 'Получатель', value: doc.citizen?.nickname ?? 'Без привязки' }],
      })
      return
    }

    res.json(<VerifyResult>{ found: false })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка проверки документа' })
  }
})

export default router

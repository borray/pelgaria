import { Prisma, PrismaClient } from '@prisma/client'
import crypto from 'crypto'

type DbClient = PrismaClient | Prisma.TransactionClient

export async function nextDocumentNumber(
  db: DbClient,
  key: string,
  prefix: string,
  date = new Date()
): Promise<string> {
  const year = date.getFullYear()
  const sequenceKey = `${key}:${year}`
  const sequence = await db.documentSequence.upsert({
    where: { key: sequenceKey },
    create: { key: sequenceKey, value: 1 },
    update: { value: { increment: 1 } },
  })
  return `${prefix}-${year}-${String(sequence.value).padStart(4, '0')}`
}

export function registryCode(kind: string, number: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(`SONAR:${kind}:${number}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
  return `ШК-${kind}-${digest}`
}

export function normalizeManualNumber(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '-')
  if (!/^[А-ЯA-Z0-9][А-ЯA-Z0-9./-]{2,39}$/u.test(normalized)) {
    throw new Error('Номер должен содержать 3–40 символов: буквы, цифры, точки, / или -')
  }
  return normalized
}

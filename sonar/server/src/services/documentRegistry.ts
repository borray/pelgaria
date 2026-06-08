import { Prisma, PrismaClient } from '@prisma/client'
import crypto from 'crypto'

type DbClient = PrismaClient | Prisma.TransactionClient

// Crockford-подобный алфавит без неоднозначных символов (нет I, O, 0, 1)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomGroup(size: number): string {
  const bytes = crypto.randomBytes(size)
  let out = ''
  for (let i = 0; i < size; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return out
}

// Случайный «зашифрованный» код вида X7F3-A9K2-M4P8.
// 3 группы по 4 символа из 32-символьного алфавита ≈ 60 бит энтропии —
// порядок выдачи документов по номеру восстановить невозможно.
export function randomDocumentCode(groups = 3, size = 4): string {
  return Array.from({ length: groups }, () => randomGroup(size)).join('-')
}

/**
 * Возвращает уникальный случайный номер документа.
 * Номера больше НЕ выдаются по порядку — каждый получает непредсказуемый код.
 * Сигнатура сохранена ради совместимости со всеми вызовами (passports, cases,
 * punishments, laws and generated documents).
 */
export async function nextDocumentNumber(
  _db: DbClient,
  _key: string,
  _prefix: string,
  _date = new Date()
): Promise<string> {
  return randomDocumentCode()
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

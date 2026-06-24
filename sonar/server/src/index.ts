import 'dotenv/config'
import { promisify } from 'node:util'
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { PrismaClient, SonarAccountRole, SonarCouncilDecisionStatus, SonarPassportStatus, type SonarAccount } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()
const port = Number(process.env.PORT ?? 3001)
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
const isProduction = process.env.NODE_ENV === 'production'
const scrypt = promisify(scryptCallback)
const sessionLifetimeMs = 8 * 60 * 60 * 1000
const maxFailedAttempts = 5
const attemptWindowMs = 15 * 60 * 1000

type AuthenticatedRequest = Request & { account?: SonarAccount; sessionId?: string }
type FailedAttempt = { count: number; resetAt: number }
const failedAttempts = new Map<string, FailedAttempt>()

app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(express.json({ limit: '20kb', strict: true }))
app.use(cors({ origin: clientUrl, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }))
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (origin && origin !== clientUrl) return res.status(403).json({ error: 'Недопустимый источник запроса.' })
  next()
})

function normalizeLogin(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const login = value.trim().toLowerCase()
  return /^[a-z0-9._-]{3,32}$/.test(login) ? login : null
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
}

function isChairman(req: AuthenticatedRequest): boolean {
  return req.account?.role === SonarAccountRole.CHAIRMAN
}

function parseDecision(value: unknown): { title: string; body: string } | null {
  if (!value || typeof value !== 'object') return null
  const { title, body } = value as Record<string, unknown>
  if (typeof title !== 'string' || typeof body !== 'string') return null
  const normalizedTitle = title.trim()
  const normalizedBody = body.trim()
  if (normalizedTitle.length < 3 || normalizedTitle.length > 160 || normalizedBody.length < 10 || normalizedBody.length > 12000) return null
  return { title: normalizedTitle, body: normalizedBody }
}

function parsePlayer(value: unknown): { nickname: string; minecraftUuid: string | null; note: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const { nickname, minecraftUuid, note } = value as Record<string, unknown>
  if (typeof nickname !== 'string') return null
  const normalizedNickname = nickname.trim()
  if (!/^[A-Za-z0-9_]{3,16}$/.test(normalizedNickname)) return null
  const normalizedUuid = typeof minecraftUuid === 'string' && minecraftUuid.trim() ? minecraftUuid.trim().toLowerCase() : null
  if (normalizedUuid && !/^[0-9a-f]{8}-?[0-9a-f]{4}-?[1-5][0-9a-f]{3}-?[89ab][0-9a-f]{3}-?[0-9a-f]{12}$/i.test(normalizedUuid)) return null
  const normalizedNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null
  return { nickname: normalizedNickname, minecraftUuid: normalizedUuid, note: normalizedNote }
}

function uniqueViolationTarget(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const code = (error as { code?: string }).code
  if (code !== 'P2002') return null
  const target = (error as { meta?: { target?: unknown } }).meta?.target
  if (Array.isArray(target)) return target.map(String).join(',')
  return typeof target === 'string' ? target : 'unknown'
}

async function createPassportForPlayer(playerId: string, accountId: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await prisma.sonarPassport.create({ data: { number: newPassportNumber(), player_id: playerId, issued_by_id: accountId } })
      return
    } catch (error) {
      // Only retry when the random passport number collides; rethrow anything else.
      if (uniqueViolationTarget(error)?.includes('number') && attempt < 4) continue
      throw error
    }
  }
}

function passportSecret(): string {
  const secret = process.env.PASSPORT_QR_SECRET
  if (!secret || secret.length < 32) throw new Error('PASSPORT_QR_SECRET must contain at least 32 characters.')
  return secret
}

function newPassportNumber(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(10)
  let body = ''
  for (const byte of bytes) body += alphabet[byte % alphabet.length]
  return `PG-${body.slice(0, 5)}-${body.slice(5)}`
}

function passportSignature(number: string): string {
  return createHmac('sha256', passportSecret()).update(`pelgrad-passport:v1:${number}`).digest('base64url').slice(0, 20)
}

function passportQrPayload(number: string): string {
  return `PGP1.${number}.${passportSignature(number)}`
}

function isValidPassportCode(number: string, code?: string): boolean {
  if (!code) return true
  const actual = Buffer.from(code)
  const expected = Buffer.from(passportQrPayload(number))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

type PassportPrintData = {
  number: string
  status: SonarPassportStatus
  issued_at: Date
  player: { nickname: string; minecraft_uuid: string | null }
  issued_by: { login: string }
}

function drawPassportMark(doc: InstanceType<typeof PDFDocument>, x: number, y: number, size: number): void {
  const unit = size / 5
  doc.save().fillColor('#111')
  for (const [col, row] of [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [2, 4]]) {
    doc.rect(x + col * unit, y + row * unit, unit, unit).fill()
  }
  doc.restore()
}

function drawGuilloche(doc: InstanceType<typeof PDFDocument>, cx: number, cy: number, radius: number): void {
  doc.save().lineWidth(.35).strokeColor('#b6b6b6')
  for (let ring = 0; ring < 3; ring += 1) {
    const r = radius - ring * 8
    doc.moveTo(cx + r, cy)
    for (let step = 1; step <= 360; step += 3) {
      const angle = step * Math.PI / 180
      const wave = Math.sin(angle * 8) * (2 + ring)
      doc.lineTo(cx + Math.cos(angle) * (r + wave), cy + Math.sin(angle) * (r + wave))
    }
    doc.closePath().stroke()
  }
  doc.restore()
}

async function createPassportPdf(passport: PassportPrintData): Promise<Buffer> {
  const verification = passportQrPayload(passport.number)
  const qr = await QRCode.toBuffer(`https://pg-bridge.ru/#verify?code=${encodeURIComponent(verification)}`, { type: 'png', errorCorrectionLevel: 'M', margin: 1, width: 360 })
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false, info: { Title: `Pelgrad passport ${passport.number}`, Author: 'SONAR' } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    const width = 841.89
    const height = 595.28
    const half = width / 2
    const issued = passport.issued_at.toISOString().slice(0, 10)
    const border = (x: number) => {
      doc.save().lineWidth(1).strokeColor('#111').rect(x + 18, 18, half - 36, height - 36).stroke()
      doc.lineWidth(.45).strokeColor('#777').rect(x + 25, 25, half - 50, height - 50).stroke()
      drawGuilloche(doc, x + half - 92, 91, 45)
      doc.restore()
    }
    const label = (text: string, x: number, y: number, size = 7) => doc.fillColor('#555').font('Helvetica-Bold').fontSize(size).text(text, x, y, { characterSpacing: .8 })
    const value = (text: string, x: number, y: number, size = 15) => doc.fillColor('#111').font('Helvetica-Bold').fontSize(size).text(text, x, y)

    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 })
    border(0); border(half)
    // Outside: left is the back cover, right is the front cover after folding.
    label('PELGRAD / DOCUMENT CONTROL', 42, 48, 8)
    value('PASSPORT CHECK', 42, 69, 22)
    doc.fillColor('#444').font('Helvetica').fontSize(9).text('Verify the document number or scan the QR code\nat pg-bridge.ru/#verify', 42, 106)
    doc.image(qr, 42, 168, { width: 124 })
    label('PASSPORT NUMBER', 42, 310)
    value(passport.number, 42, 325, 16)
    label('QR CONTROL CODE', 42, 364)
    doc.fillColor('#333').font('Courier').fontSize(7).text(verification, 42, 377)
    doc.fillColor('#666').font('Helvetica').fontSize(7).text('Print landscape, double-sided, flip on short edge. Fold at the center.', 42, 525, { width: half - 84 })

    drawPassportMark(doc, half + 42, 51, 48)
    label('REPUBLIC OF PELGRAD', half + 106, 54, 8)
    value('PASSPORT', half + 42, 124, 42)
    doc.fillColor('#4b4b4b').font('Helvetica').fontSize(11).text('Official player identity document', half + 45, 178)
    doc.moveTo(half + 42, 222).lineTo(width - 42, 222).lineWidth(.7).strokeColor('#111').stroke()
    label('HOLDER', half + 42, 247)
    value(passport.player.nickname, half + 42, 263, 25)
    label('PASSPORT NUMBER', half + 42, 321)
    value(passport.number, half + 42, 336, 16)
    doc.fillColor('#666').font('Helvetica').fontSize(7).text('SONAR / PELGRAD', half + 42, 524)

    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 })
    border(0); border(half)
    // Inside left page.
    label('PLAYER RECORD', 42, 48, 8)
    value('IDENTITY', 42, 72, 26)
    label('MINECRAFT NICKNAME', 42, 136); value(passport.player.nickname, 42, 151, 19)
    label('MINECRAFT UUID', 42, 208); doc.fillColor('#111').font('Courier').fontSize(10).text(passport.player.minecraft_uuid ?? 'NOT RECORDED', 42, 223)
    label('ISSUED', 42, 278); value(issued, 42, 293, 13)
    label('ISSUED BY', 42, 345); value(passport.issued_by.login.toUpperCase(), 42, 360, 13)
    label('STATUS', 42, 412); value(passport.status === SonarPassportStatus.ACTIVE ? 'ACTIVE' : 'REVOKED', 42, 427, 13)
    doc.fillColor('#666').font('Helvetica').fontSize(7).text('This document belongs to the fictional Minecraft RP world Pelgaria.', 42, 524)

    // Inside right page.
    label('AUTHENTICITY', half + 42, 48, 8)
    value('VERIFY', half + 42, 72, 26)
    doc.image(qr, half + 42, 130, { width: 177 })
    label('UNIQUE QR', half + 239, 144); doc.fillColor('#333').font('Helvetica').fontSize(9).text('The code contains a signed\nverification reference for this\nexact passport number.', half + 239, 160)
    label('NUMBER', half + 239, 240); value(passport.number, half + 239, 255, 14)
    doc.moveTo(half + 42, 347).lineTo(width - 42, 347).lineWidth(.5).strokeColor('#777').stroke()
    doc.fillColor('#555').font('Helvetica').fontSize(8).text('A passport is valid only while the verification service reports ACTIVE status.', half + 42, 365, { width: half - 84 })
    doc.fillColor('#666').font('Helvetica').fontSize(7).text('PELGRAD / SONAR / PASSPORT BOOKLET', half + 42, 524)
    doc.end()
  })
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const derived = await scrypt(password, salt, 64) as Buffer
  return `scrypt$${salt}$${derived.toString('base64url')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, encodedHash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !encodedHash) return false
  const derived = await scrypt(password, salt, 64) as Buffer
  const expected = Buffer.from(encodedHash, 'base64url')
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return undefined
  const pair = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  if (!pair) return undefined
  try { return decodeURIComponent(pair.slice(name.length + 1)) } catch { return undefined }
}

function setSessionCookie(res: Response, token: string): void {
  const flags = [`sonar_session=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${sessionLifetimeMs / 1000}`]
  if (isProduction) flags.push('Secure')
  res.setHeader('Set-Cookie', flags.join('; '))
}

function clearSessionCookie(res: Response): void {
  const flags = ['sonar_session=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0']
  if (isProduction) flags.push('Secure')
  res.setHeader('Set-Cookie', flags.join('; '))
}

function accountView(account: SonarAccount) {
  return { id: account.id, login: account.login, role: account.role, lastLoginAt: account.last_login_at }
}

function attemptKey(req: Request, login: string): string {
  return `${hashToken(req.ip ?? 'unknown')}:${login}`
}

function isLocked(key: string): boolean {
  const entry = failedAttempts.get(key)
  if (!entry) return false
  if (entry.resetAt <= Date.now()) { failedAttempts.delete(key); return false }
  return entry.count >= maxFailedAttempts
}

function recordFailure(key: string): void {
  const current = failedAttempts.get(key)
  const resetAt = Date.now() + attemptWindowMs
  const count = current && current.resetAt > Date.now() ? current.count + 1 : 1
  failedAttempts.set(key, { count, resetAt })
}

async function createSession(req: Request, res: Response, account: SonarAccount): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  await prisma.sonarSession.deleteMany({ where: { expires_at: { lt: now } } })
  await prisma.sonarSession.create({
    data: {
      token_hash: hashToken(token),
      account_id: account.id,
      expires_at: new Date(now.getTime() + sessionLifetimeMs),
      user_agent: req.get('user-agent')?.slice(0, 300),
      ip_hash: hashToken(req.ip ?? 'unknown'),
    },
  })
  setSessionCookie(res, token)
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readCookie(req, 'sonar_session')
    if (!token) { res.status(401).json({ error: 'Требуется вход в СОНАР.' }); return }
    const session = await prisma.sonarSession.findUnique({ where: { token_hash: hashToken(token) }, include: { account: true } })
    if (!session || session.expires_at <= new Date() || !session.account.is_active) {
      if (session) await prisma.sonarSession.delete({ where: { id: session.id } })
      clearSessionCookie(res)
      res.status(401).json({ error: 'Сессия завершена. Войдите снова.' })
      return
    }
    req.account = session.account
    req.sessionId = session.id
    if (Date.now() - session.last_seen_at.getTime() > 10 * 60 * 1000) {
      void prisma.sonarSession.update({ where: { id: session.id }, data: { last_seen_at: new Date() } })
    }
    next()
  } catch (error) { next(error) }
}

async function bootstrapChairman(): Promise<void> {
  const count = await prisma.sonarAccount.count()
  if (count > 0) return
  const login = normalizeLogin(process.env.SONAR_INITIAL_LOGIN)
  const password = process.env.SONAR_INITIAL_PASSWORD
  if (!login || !isValidPassword(password)) {
    throw new Error('SONAR_INITIAL_LOGIN и SONAR_INITIAL_PASSWORD требуются для первого запуска СОНАР.')
  }
  await prisma.sonarAccount.create({
    data: { login, password_hash: await hashPassword(password), role: SonarAccountRole.CHAIRMAN },
  })
  console.log(`Initial chairman account created for ${login}`)
}

async function ensureSonarSchema(): Promise<void> {
  // The legacy schema is deliberately left intact. This creates only the new SONAR contour.
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE sonar_account_role AS ENUM ('CHAIRMAN', 'OPERATOR');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sonar_accounts (
      id TEXT PRIMARY KEY,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role sonar_account_role NOT NULL DEFAULT 'OPERATOR',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMPTZ,
      password_changed TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sonar_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL REFERENCES sonar_accounts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ NOT NULL,
      user_agent TEXT,
      ip_hash TEXT
    );
  `)
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS sonar_sessions_account_id_idx ON sonar_sessions(account_id);')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS sonar_sessions_expires_at_idx ON sonar_sessions(expires_at);')
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE sonar_council_decision_status AS ENUM ('DRAFT', 'ADOPTED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sonar_council_decisions (
      id TEXT PRIMARY KEY,
      number SERIAL UNIQUE NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status sonar_council_decision_status NOT NULL DEFAULT 'DRAFT',
      author_id TEXT NOT NULL REFERENCES sonar_accounts(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      adopted_at TIMESTAMPTZ
    );
  `)
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS sonar_council_decisions_status_idx ON sonar_council_decisions(status);')
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE sonar_passport_status AS ENUM ('ACTIVE', 'REVOKED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sonar_players (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL UNIQUE,
      minecraft_uuid TEXT UNIQUE,
      note TEXT,
      registered_by_id TEXT NOT NULL REFERENCES sonar_accounts(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sonar_passports (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      player_id TEXT NOT NULL UNIQUE REFERENCES sonar_players(id) ON DELETE CASCADE,
      issued_by_id TEXT NOT NULL REFERENCES sonar_accounts(id) ON DELETE RESTRICT,
      status sonar_passport_status NOT NULL DEFAULT 'ACTIVE',
      issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMPTZ
    );
  `)
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS sonar_passports_status_idx ON sonar_passports(status);')
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', phase: 'sonar-alpha', message: 'СОНАР нового цикла разворачивается для Пельграда.', timestamp: new Date().toISOString() })
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const login = normalizeLogin(req.body?.login)
    const password = req.body?.password
    if (!login || typeof password !== 'string') { res.status(400).json({ error: 'Укажите логин и пароль.' }); return }
    const key = attemptKey(req, login)
    if (isLocked(key)) { res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже.' }); return }
    const account = await prisma.sonarAccount.findUnique({ where: { login } })
    const valid = account && account.is_active && await verifyPassword(password, account.password_hash)
    if (!valid) { recordFailure(key); res.status(401).json({ error: 'Неверный логин или пароль.' }); return }
    failedAttempts.delete(key)
    await prisma.sonarAccount.update({ where: { id: account.id }, data: { last_login_at: new Date() } })
    await createSession(req, res, account)
    res.json({ account: accountView({ ...account, last_login_at: new Date() }) })
  } catch (error) { next(error) }
})

app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (req.sessionId) await prisma.sonarSession.delete({ where: { id: req.sessionId } })
    clearSessionCookie(res)
    res.status(204).end()
  } catch (error) { next(error) }
})

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => res.json({ account: accountView(req.account!) }))

app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const currentPassword = req.body?.currentPassword
    const newPassword = req.body?.newPassword
    if (typeof currentPassword !== 'string' || !isValidPassword(newPassword)) {
      res.status(400).json({ error: 'Новый пароль должен содержать от 12 до 128 символов.' })
      return
    }
    if (!await verifyPassword(currentPassword, req.account!.password_hash)) { res.status(401).json({ error: 'Текущий пароль неверен.' }); return }
    await prisma.sonarAccount.update({ where: { id: req.account!.id }, data: { password_hash: await hashPassword(newPassword), password_changed: new Date() } })
    await prisma.sonarSession.deleteMany({ where: { account_id: req.account!.id, NOT: { id: req.sessionId } } })
    res.status(204).end()
  } catch (error) { next(error) }
})

app.get('/api/system/overview', requireAuth, (_req, res) => {
  res.json({
    phase: 'sonar-alpha',
    milestones: [
      { id: 'foundation', title: 'Основание мира', state: 'complete' },
      { id: 'access', title: 'Контур доступа', state: 'complete' },
      { id: 'council', title: 'Верховный Совет', state: 'next' },
      { id: 'registry', title: 'Реестр мира', state: 'planned' },
    ],
  })
})

app.get('/api/council/decisions', requireAuth, async (_req, res, next) => {
  try {
    const decisions = await prisma.sonarCouncilDecision.findMany({
      orderBy: { number: 'desc' },
      include: { author: { select: { login: true } } },
    })
    res.json({ decisions })
  } catch (error) { next(error) }
})

app.post('/api/council/decisions', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Создавать решения может только Председатель.' }); return }
    const decision = parseDecision(req.body)
    if (!decision) { res.status(400).json({ error: 'Заголовок должен содержать 3–160 символов, текст — 10–12000.' }); return }
    const created = await prisma.sonarCouncilDecision.create({
      data: { ...decision, author_id: req.account!.id },
      include: { author: { select: { login: true } } },
    })
    res.status(201).json({ decision: created })
  } catch (error) { next(error) }
})

app.patch('/api/council/decisions/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Редактировать решения может только Председатель.' }); return }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id) { res.status(400).json({ error: 'Не указан идентификатор решения.' }); return }
    const decision = parseDecision(req.body)
    if (!decision) { res.status(400).json({ error: 'Заголовок должен содержать 3–160 символов, текст — 10–12000.' }); return }
    try {
      const updated = await prisma.sonarCouncilDecision.update({
        where: { id },
        data: { title: decision.title, body: decision.body },
        include: { author: { select: { login: true } } },
      })
      res.json({ decision: updated })
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') { res.status(404).json({ error: 'Решение не найдено.' }); return }
      throw error
    }
  } catch (error) { next(error) }
})

app.post('/api/council/decisions/:id/adopt', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Принимать решения может только Председатель.' }); return }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id) { res.status(400).json({ error: 'Не указан идентификатор решения.' }); return }
    const decision = await prisma.sonarCouncilDecision.update({
      where: { id },
      data: { status: SonarCouncilDecisionStatus.ADOPTED, adopted_at: new Date() },
      include: { author: { select: { login: true } } },
    })
    res.json({ decision })
  } catch (error) { next(error) }
})

app.delete('/api/council/decisions/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Удалять решения может только Председатель.' }); return }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id) { res.status(400).json({ error: 'Не указан идентификатор решения.' }); return }
    await prisma.sonarCouncilDecision.delete({ where: { id } })
    res.status(204).end()
  } catch (error) { next(error) }
})

app.get('/api/players', requireAuth, async (_req, res, next) => {
  try {
    const players = await prisma.sonarPlayer.findMany({ orderBy: { created_at: 'desc' }, include: { passport: true } })
    res.json({ players })
  } catch (error) { next(error) }
})

app.post('/api/players', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Регистрировать игроков может только Председатель.' }); return }
    const player = parsePlayer(req.body)
    if (!player) { res.status(400).json({ error: 'Укажите корректный Minecraft-ник (3-16 латинских символов, цифр или _). UUID необязателен.' }); return }
    const issuePassport = req.body?.issuePassport !== false
    try {
      const created = await prisma.sonarPlayer.create({
        data: {
          nickname: player.nickname,
          minecraft_uuid: player.minecraftUuid,
          note: player.note,
          registered_by_id: req.account!.id,
        },
      })
      if (issuePassport) await createPassportForPlayer(created.id, req.account!.id)
      const full = await prisma.sonarPlayer.findUnique({ where: { id: created.id }, include: { passport: true } })
      res.status(201).json({ player: full })
    } catch (error) {
      const target = uniqueViolationTarget(error)
      if (target) { res.status(409).json({ error: target.includes('uuid') ? 'Игрок с таким UUID уже зарегистрирован.' : 'Игрок с таким ником уже зарегистрирован.' }); return }
      throw error
    }
  } catch (error) { next(error) }
})

app.patch('/api/players/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Редактировать записи игроков может только Председатель.' }); return }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id) { res.status(400).json({ error: 'Не указан идентификатор игрока.' }); return }
    const player = parsePlayer(req.body)
    if (!player) { res.status(400).json({ error: 'Укажите корректный Minecraft-ник (3-16 латинских символов, цифр или _). UUID необязателен.' }); return }
    try {
      const updated = await prisma.sonarPlayer.update({
        where: { id },
        data: { nickname: player.nickname, minecraft_uuid: player.minecraftUuid, note: player.note },
        include: { passport: true },
      })
      res.json({ player: updated })
    } catch (error) {
      const target = uniqueViolationTarget(error)
      if (target) { res.status(409).json({ error: target.includes('uuid') ? 'Игрок с таким UUID уже зарегистрирован.' : 'Игрок с таким ником уже зарегистрирован.' }); return }
      if ((error as { code?: string }).code === 'P2025') { res.status(404).json({ error: 'Игрок не найден.' }); return }
      throw error
    }
  } catch (error) { next(error) }
})

app.post('/api/players/:id/passport', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Выдавать паспорта может только Председатель.' }); return }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id) { res.status(400).json({ error: 'Не указан идентификатор игрока.' }); return }
    const player = await prisma.sonarPlayer.findUnique({ where: { id }, include: { passport: true } })
    if (!player) { res.status(404).json({ error: 'Игрок не найден.' }); return }
    if (player.passport) { res.status(409).json({ error: 'Паспорт уже выдан этому игроку.' }); return }
    await createPassportForPlayer(player.id, req.account!.id)
    const full = await prisma.sonarPlayer.findUnique({ where: { id }, include: { passport: true } })
    res.status(201).json({ player: full })
  } catch (error) { next(error) }
})

app.post('/api/players/:id/passport/status', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Менять статус паспорта может только Председатель.' }); return }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id) { res.status(400).json({ error: 'Не указан идентификатор игрока.' }); return }
    const status = req.body?.status
    if (status !== 'ACTIVE' && status !== 'REVOKED') { res.status(400).json({ error: 'Недопустимый статус паспорта.' }); return }
    const player = await prisma.sonarPlayer.findUnique({ where: { id }, include: { passport: true } })
    if (!player?.passport) { res.status(404).json({ error: 'Паспорт не найден.' }); return }
    await prisma.sonarPassport.update({
      where: { id: player.passport.id },
      data: { status, revoked_at: status === SonarPassportStatus.REVOKED ? new Date() : null },
    })
    const full = await prisma.sonarPlayer.findUnique({ where: { id }, include: { passport: true } })
    res.json({ player: full })
  } catch (error) { next(error) }
})

app.get('/api/players/:id/passport.pdf', requireAuth, async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id) { res.status(400).json({ error: 'Не указан идентификатор игрока.' }); return }
    const player = await prisma.sonarPlayer.findUnique({ where: { id }, include: { passport: { include: { issued_by: { select: { login: true } } } } } })
    if (!player?.passport) { res.status(404).json({ error: 'Паспорт не найден.' }); return }
    const pdf = await createPassportPdf({ ...player.passport, player: { nickname: player.nickname, minecraft_uuid: player.minecraft_uuid }, issued_by: player.passport.issued_by })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${player.passport.number}.pdf"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(pdf)
  } catch (error) { next(error) }
})

app.delete('/api/players/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!isChairman(req)) { res.status(403).json({ error: 'Удалять записи игроков может только Председатель.' }); return }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id) { res.status(400).json({ error: 'Не указан идентификатор игрока.' }); return }
    await prisma.sonarPlayer.delete({ where: { id } })
    res.status(204).end()
  } catch (error) { next(error) }
})

app.get('/api/public/passports/:number', async (req, res, next) => {
  try {
    const number = Array.isArray(req.params.number) ? req.params.number[0] : req.params.number
    const code = typeof req.query.code === 'string' ? req.query.code : undefined
    if (!number || !/^PG-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(number)) { res.status(404).json({ valid: false }) ; return }
    if (!isValidPassportCode(number, code)) { res.status(404).json({ valid: false }); return }
    const passport = await prisma.sonarPassport.findUnique({ where: { number }, include: { player: true } })
    if (!passport) { res.status(404).json({ valid: false }); return }
    res.json({ valid: passport.status === SonarPassportStatus.ACTIVE, number: passport.number, status: passport.status, holder: passport.player.nickname, issuedAt: passport.issued_at })
  } catch (error) { next(error) }
})

app.all('/api/*', (_req, res) => res.status(410).json({ error: 'Этот модуль ещё не создан в новом СОНАР.', phase: 'sonar-alpha' }))

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error)
  res.status(500).json({ error: 'Внутренняя ошибка СОНАР.' })
})

async function start(): Promise<void> {
  await ensureSonarSchema()
  await bootstrapChairman()
  app.listen(port, () => console.log(`Pelgaria SONAR alpha server is listening on ${port}`))
}

void start().catch((error) => { console.error(error); process.exit(1) })

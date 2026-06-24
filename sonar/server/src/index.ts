import 'dotenv/config'
import { promisify } from 'node:util'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { PrismaClient, SonarAccountRole, type SonarAccount } from '@prisma/client'

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
app.use(cors({ origin: clientUrl, credentials: true, methods: ['GET', 'POST', 'OPTIONS'] }))
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

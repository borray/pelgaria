import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || ''
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || ''
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || ''
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

type DiscordOAuthState = {
  flow: 'login' | 'link'
  userId?: string
}

function discordConfigured(): boolean {
  return Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET && DISCORD_REDIRECT_URI)
}

function createOAuthState(payload: DiscordOAuthState): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.sign(payload, secret, { expiresIn: '10m', audience: 'discord-oauth', issuer: 'sonar' })
}

function readOAuthState(value: unknown): DiscordOAuthState {
  const secret = process.env.JWT_SECRET
  if (!secret || typeof value !== 'string') throw new Error('Invalid OAuth state')
  const decoded = jwt.verify(value, secret, { audience: 'discord-oauth', issuer: 'sonar' })
  if (typeof decoded === 'string' || (decoded.flow !== 'login' && decoded.flow !== 'link')) {
    throw new Error('Invalid OAuth state')
  }
  return { flow: decoded.flow, userId: typeof decoded.userId === 'string' ? decoded.userId : undefined }
}

function generateAccessToken(user: {
  id: string
  login: string
  role: { id: string; name: string; color: string }
  permissions: Record<string, boolean>
}): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.sign(user, secret, { expiresIn: '15m' })
}

function generateRefreshToken(userId: string): string {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) throw new Error('JWT_REFRESH_SECRET not configured')
  return jwt.sign({ userId }, secret, { expiresIn: '30d' })
}

// GET /api/auth/discord/status — public OAuth readiness for login UI
router.get('/status', (_req: Request, res: Response) => {
  res.json({ configured: discordConfigured() })
})

// GET /api/auth/discord — redirect to Discord OAuth (link account, requires auth)
router.get('/', requireAuth, (req: Request, res: Response) => {
  if (!discordConfigured()) {
    res.status(503).json({ error: 'Discord OAuth не настроен' })
    return
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state: createOAuthState({ flow: 'link', userId: req.user!.id }),
  })

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`)
})

// GET /api/auth/discord/login — redirect to Discord OAuth for login (no auth required)
router.get('/login', (req: Request, res: Response) => {
  if (!discordConfigured()) {
    res.status(503).json({ error: 'Discord OAuth не настроен' })
    return
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state: createOAuthState({ flow: 'login' }),
  })

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`)
})

// GET /api/auth/discord/callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query

  if (!code || !state) {
    res.redirect(`${CLIENT_URL}/login?error=discord_cancelled`)
    return
  }
  if (!discordConfigured()) {
    res.redirect(`${CLIENT_URL}/login?error=discord_unavailable`)
    return
  }

  try {
    const oauthState = readOAuthState(state)

    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    })

    if (!tokenRes.ok) {
      res.redirect(`${CLIENT_URL}/login?error=discord_exchange`)
      return
    }

    const tokenData = (await tokenRes.json()) as { access_token: string }

    // Fetch Discord user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      res.redirect(`${CLIENT_URL}/login?error=discord_profile`)
      return
    }

    const discordUser = (await userRes.json()) as {
      id: string
      username: string
      avatar: string | null
    }

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null

    if (oauthState.flow === 'login') {
      const user = await prisma.user.findFirst({
        where: { discord_id: discordUser.id },
        include: { role: true },
      })

      if (!user || !user.is_active) {
        res.redirect(`${CLIENT_URL}/login?error=discord_not_linked`)
        return
      }

      const permissions = (user.role.permissions as Record<string, boolean>) || {}
      const tokenPayload = {
        id: user.id,
        login: user.login,
        role: { id: user.role.id, name: user.role.name, color: user.role.color },
        permissions,
      }

      const accessToken = generateAccessToken(tokenPayload)
      const refreshTokenStr = generateRefreshToken(user.id)

      await prisma.refreshToken.create({
        data: {
          token: refreshTokenStr,
          user_id: user.id,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })

      await prisma.user.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
      })

      const userJson = encodeURIComponent(
        JSON.stringify({
          id: user.id,
          login: user.login,
          role: tokenPayload.role,
          permissions,
          must_change_password: user.must_change_password,
          discord_username: user.discord_username,
          discord_avatar: user.discord_avatar,
        })
      )

      res.redirect(
        `${CLIENT_URL}/discord-callback?accessToken=${accessToken}&refreshToken=${refreshTokenStr}&user=${userJson}`
      )
      return
    }

    const userId = oauthState.userId
    if (!userId) throw new Error('Missing link user')

    await prisma.user.update({
      where: { id: userId },
      data: {
        discord_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: avatarUrl,
      },
    })

    // Also update citizen's discord_username if linked
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { citizen: true },
    })

    if (user?.citizen) {
      await prisma.citizen.update({
        where: { id: user.citizen.id },
        data: { discord_username: discordUser.username },
      })
    }

    res.redirect(`${CLIENT_URL}/profile?discord=success`)
  } catch (err) {
    console.error('Discord callback error:', err)
    res.redirect(`${CLIENT_URL}/login?error=discord_state`)
  }
})

// DELETE /api/auth/discord — unlink Discord
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: (req as any).user.id },
      data: {
        discord_id: null,
        discord_username: null,
        discord_avatar: null,
      },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отвязки Discord' })
  }
})

export default router

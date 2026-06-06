import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || ''
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || ''
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || ''
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// GET /api/auth/discord — redirect to Discord OAuth
router.get('/', requireAuth, (req: Request, res: Response) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
    res.status(503).json({ error: 'Discord OAuth не настроен' })
    return
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state: (req as any).user.id,
  })

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`)
})

// GET /api/auth/discord/callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state: userId } = req.query

  if (!code || !userId) {
    res.redirect(`${CLIENT_URL}/profile?discord=error`)
    return
  }

  try {
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
      res.redirect(`${CLIENT_URL}/profile?discord=error`)
      return
    }

    const tokenData = (await tokenRes.json()) as { access_token: string }

    // Fetch Discord user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      res.redirect(`${CLIENT_URL}/profile?discord=error`)
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

    await prisma.user.update({
      where: { id: userId as string },
      data: {
        discord_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: avatarUrl,
      },
    })

    // Also update citizen's discord_username if linked
    const user = await prisma.user.findUnique({
      where: { id: userId as string },
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
    res.redirect(`${CLIENT_URL}/profile?discord=error`)
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

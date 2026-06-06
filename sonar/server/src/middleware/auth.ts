import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthUser {
  id: string
  login: string
  role: {
    id: string
    name: string
    color: string
  }
  permissions: Record<string, boolean>
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' })
    return
  }

  const token = authHeader.slice(7)
  const secret = process.env.JWT_SECRET
  if (!secret) {
    res.status(500).json({ error: 'Ошибка конфигурации сервера' })
    return
  }

  try {
    const payload = jwt.verify(token, secret) as AuthUser & { iat: number; exp: number }
    req.user = {
      id: payload.id,
      login: payload.login,
      role: payload.role,
      permissions: payload.permissions,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Токен недействителен или истёк' })
  }
}

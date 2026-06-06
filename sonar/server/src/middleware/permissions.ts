import { Request, Response, NextFunction } from 'express'

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user
    if (!user) {
      res.status(401).json({ error: 'Требуется авторизация' })
      return
    }

    const perms = user.permissions
    if (!perms || perms[permission] !== true) {
      res.status(403).json({
        error: 'Недостаточно прав',
        required: permission,
      })
      return
    }

    next()
  }
}

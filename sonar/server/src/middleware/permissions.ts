import { Request, Response, NextFunction } from 'express'

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user
    if (!user) {
      res.status(401).json({ error: 'Требуется авторизация' })
      return
    }

    const perms = user.permissions
    // Суперадмин проходит любую проверку прав
    if (perms?.['system.superadmin'] === true) {
      next()
      return
    }
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

const SUPERADMIN_PERMISSION = 'system.superadmin'
// Историческое имя роли — оставлено для обратной совместимости (fallback),
// пока всем суперадмин-ролям не проставлено право system.superadmin.
const LEGACY_SUPERADMIN_ROLE = 'Глава государства'

export function isSuperadmin(req: Request): boolean {
  const user = req.user
  if (!user) return false
  return user.permissions?.[SUPERADMIN_PERMISSION] === true || user.role?.name === LEGACY_SUPERADMIN_ROLE
}

/**
 * Доступ для суперадмина. Проверяет permission `system.superadmin`,
 * а при его отсутствии — историческую роль «Глава государства» (fallback).
 */
export function requireSuperadmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Требуется авторизация' })
    return
  }
  if (!isSuperadmin(req)) {
    res.status(403).json({ error: 'Действие доступно только суперадмину (глава государства)' })
    return
  }
  next()
}

// Сохранено как алиас ради обратной совместимости со всеми текущими маршрутами.
export const requireHeadOfState = requireSuperadmin


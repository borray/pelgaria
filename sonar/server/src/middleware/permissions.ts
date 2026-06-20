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

/**
 * Эффективные права роли для токена/ответа клиенту.
 * Если роль является суперадмином (есть право `system.superadmin` ИЛИ это историческая
 * роль «Глава государства»), гарантированно проставляем `system.superadmin`. Так Председатель
 * Верховного Совета получает доступ ко всем — в т.ч. новым — функциям без ручной правки роли,
 * даже если её запись в БД создана до появления этого права.
 */
export function effectivePermissions(role: { name: string; permissions: unknown }): Record<string, boolean> {
  const base = (role.permissions as Record<string, boolean>) || {}
  if (base[SUPERADMIN_PERMISSION] === true || role.name === LEGACY_SUPERADMIN_ROLE) {
    return { ...base, [SUPERADMIN_PERMISSION]: true }
  }
  return base
}

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


import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconDotsVertical } from '@tabler/icons-react'

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  label?: string
  align?: 'left' | 'right'
}

// Кебаб-меню (три точки) для второстепенных и опасных действий.
// Рендерится через портал, чтобы не обрезаться внутри таблиц с overflow.
export function ActionMenu({ items, label = 'Действия', align = 'right' }: ActionMenuProps) {
  const visible = items.filter((item) => !item.hidden)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = 220
    const left = align === 'right'
      ? Math.max(8, rect.right - width)
      : Math.min(window.innerWidth - width - 8, rect.left)
    setCoords({ top: rect.bottom + 6, left })
  }, [align])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  if (visible.length === 0) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`action-menu-trigger${open ? ' is-open' : ''}`}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
      >
        <IconDotsVertical size={16} />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          className="action-menu-popover"
          role="menu"
          style={{ top: coords.top, left: coords.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {visible.map((item, idx) => (
            <button
              key={idx}
              type="button"
              role="menuitem"
              className={`action-menu-item${item.danger ? ' is-danger' : ''}`}
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                item.onClick()
              }}
            >
              {item.icon && <span className="action-menu-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

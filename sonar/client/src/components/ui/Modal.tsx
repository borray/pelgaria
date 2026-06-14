import React, { useEffect, useId, useRef } from 'react'
import { IconAlertTriangle, IconForms, IconX } from '@tabler/icons-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
  description?: string
}

export function Modal({ open, onClose, title, description, children, footer, width = 520 }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const destructive = /удал|отоз|списат|закрыть дело/i.test(title)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previousActiveElement = document.activeElement as HTMLElement | null

    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog || dialog.contains(document.activeElement)) return

      const target =
        dialog.querySelector<HTMLElement>('[autofocus]') ??
        dialog.querySelector<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
        ) ??
        dialog
      target.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      previousActiveElement?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        ref={dialogRef}
        className={`modal-dialog${destructive ? ' is-destructive' : ''}`}
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <aside className="modal-rail" aria-hidden="true">
          <span className="modal-symbol">
            {destructive ? <IconAlertTriangle size={21} /> : <IconForms size={21} />}
          </span>
          <div><strong>СОНАР</strong><small>{destructive ? 'Контроль действия' : 'Электронная форма'}</small></div>
          <b>01</b>
        </aside>
        <div className="modal-workspace">
          <header className="modal-header">
            <div className="modal-heading">
              <span>{destructive ? 'Необратимое действие' : 'Рабочая форма'}</span>
              <h2 id={titleId}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Закрыть">
              <IconX size={19} />
            </button>
          </header>
          <div className="modal-content">{children}</div>
          {footer && <footer className="modal-footer"><span>Проверьте данные перед подтверждением</span><div>{footer}</div></footer>}
        </div>
      </section>
    </div>
  )
}

import React, { useEffect } from 'react'
import { IconX } from '@tabler/icons-react'

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
  const destructive = /удал|отоз|списат|закрыть дело/i.test(title)
  const contextDescription = description ?? (destructive
    ? 'Необратимая служебная операция. Проверьте выбранную запись и последствия действия.'
    : 'Служебная операция СОНАР. Проверьте сведения перед подтверждением.')
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,22,40,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        animation: 'backdropIn 0.2s ease',
      }}
    >
      <div
        className={`modal-dialog${destructive ? ' is-destructive' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(226,232,240,0.9)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: width,
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
          boxShadow:
            '0 24px 64px -12px rgba(10,22,40,0.45), 0 8px 24px -8px rgba(10,22,40,0.25)',
          animation: 'modalIn 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="modal-accent" />
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: '1px solid #EEF2F7',
            background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
            flexShrink: 0,
          }}
        >
          <div className="modal-heading">
            <span>СОНАР · Операция</span>
            <h2>{title}</h2>
            <p>{contextDescription}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F1F5F9'
              e.currentTarget.style.color = '#0A1628'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#94A3B8'
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        <div
          className="modal-content"
          style={{
            padding: '22px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            className="modal-footer"
            style={{
              padding: '14px 22px',
              borderTop: '1px solid #EEF2F7',
              background: '#FBFCFE',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

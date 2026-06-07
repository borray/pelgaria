import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { IconCheck, IconAlertCircle, IconInfoCircle, IconX } from '@tabler/icons-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
  dying?: boolean
}

interface ToastContextValue {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let _id = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, dying: true } : t)))
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350)
  }, [])

  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = ++_id
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => dismiss(id), 4500)
    },
    [dismiss]
  )

  const ctx: ToastContextValue = {
    success: (msg) => add('success', msg),
    error: (msg) => add('error', msg),
    info: (msg) => add('info', msg),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const cfg = {
  success: { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D', Icon: IconCheck },
  error:   { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', Icon: IconAlertCircle },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', Icon: IconInfoCircle },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { bg, border, color, Icon } = cfg[toast.type]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(15,23,42,0.1)',
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        color,
        maxWidth: 360,
        pointerEvents: 'all',
        animation: toast.dying
          ? 'toastOut 0.3s ease forwards'
          : 'toastIn 0.25s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 500 }}>{toast.message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color,
          opacity: 0.6,
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <IconX size={14} />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// Auto-dismiss progress bar component for visual polish
export function useAutoToast() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 4500)
    return () => clearTimeout(t)
  }, [])
  return visible
}

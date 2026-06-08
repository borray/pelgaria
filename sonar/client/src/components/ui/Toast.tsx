import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { IconAlertCircle, IconCheck, IconInfoCircle, IconX } from '@tabler/icons-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; type: ToastType; message: string }
interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])
  const add = useCallback((type: ToastType, message: string) => {
    const id = ++toastId
    setToasts((current) => [...current, { id, type, message }])
    window.setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{
      success: (message) => add('success', message),
      error: (message) => add('error', message),
      info: (message) => add('info', message),
    }}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />)}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = toast.type === 'success' ? IconCheck : toast.type === 'error' ? IconAlertCircle : IconInfoCircle
  return (
    <div className={`toast-item toast-${toast.type}`}>
      <Icon size={18} />
      <span>{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Закрыть"><IconX size={15} /></button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export function useAutoToast() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 4500)
    return () => window.clearTimeout(timer)
  }, [])
  return visible
}

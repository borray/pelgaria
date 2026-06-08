import type { ReactNode } from 'react'
import { IconInbox } from '@tabler/icons-react'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title = 'Нет данных', description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><IconInbox size={23} stroke={1.7} /></span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}

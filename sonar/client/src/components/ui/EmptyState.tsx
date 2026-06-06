import React from 'react'
import { IconInbox } from '@tabler/icons-react'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({
  title = 'Нет данных',
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        fontFamily: 'Inter, sans-serif',
        color: '#6B7280',
        gap: '12px',
      }}
    >
      <IconInbox size={40} stroke={1.5} color="#D0D7E3" />
      <div
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#374151',
          textAlign: 'center',
        }}
      >
        {title}
      </div>
      {description && (
        <div style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', maxWidth: 320 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: '4px' }}>{action}</div>}
    </div>
  )
}

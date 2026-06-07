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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #F1F5F9 0%, #E8EFF8 100%)',
          border: '1px solid #E2E8F0',
        }}
      >
        <IconInbox size={30} stroke={1.5} color="#94A3B8" />
      </div>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: '#0F172A',
          textAlign: 'center',
          letterSpacing: '-0.01em',
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

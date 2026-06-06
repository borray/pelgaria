import React from 'react'
import { getStatusLabel, getStatusColor } from '../../utils/formatters'

interface BadgeProps {
  status: string
  label?: string
  color?: string
}

export function Badge({ status, label, color }: BadgeProps) {
  const bg = color ?? getStatusColor(status)
  const text = label ?? getStatusLabel(status)

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: 'Inter, sans-serif',
        background: bg + '1A',
        color: bg,
        border: `1px solid ${bg}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}

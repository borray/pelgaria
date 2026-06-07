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
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.01em',
        fontFamily: 'Inter, sans-serif',
        background: bg + '14',
        color: bg,
        border: `1px solid ${bg}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}

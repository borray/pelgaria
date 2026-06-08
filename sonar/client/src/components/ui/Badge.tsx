import { getStatusLabel, getStatusColor } from '../../utils/formatters'

interface BadgeProps {
  status: string
  label?: string
  color?: string
}

export function Badge({ status, label, color }: BadgeProps) {
  const tone = color ?? getStatusColor(status)
  return (
    <span className="ui-badge" style={{ '--badge-color': tone } as React.CSSProperties}>
      {label ?? getStatusLabel(status)}
    </span>
  )
}

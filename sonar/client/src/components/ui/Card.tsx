import type { CSSProperties, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  title?: string
  onClick?: () => void
}

export function Card({ children, style, title, onClick }: CardProps) {
  return (
    <div className={`ui-card${onClick ? ' is-clickable' : ''}`} onClick={onClick} style={style}>
      {title && <div className="ui-card-title">{title}</div>}
      <div className="ui-card-body">{children}</div>
    </div>
  )
}

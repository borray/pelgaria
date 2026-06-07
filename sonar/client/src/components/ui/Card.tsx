import React from 'react'

interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  title?: string
  onClick?: () => void
}

export function Card({ children, style, title, onClick }: CardProps) {
  const isClickable = !!onClick

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isClickable) {
      const el = e.currentTarget
      el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.1)'
      el.style.transform = 'translateY(-1px)'
    }
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isClickable) {
      const el = e.currentTarget
      el.style.boxShadow = '0 1px 4px rgba(15,23,42,0.06)'
      el.style.transform = 'translateY(0)'
    }
  }

  return (
    <div
      className="ui-card"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        fontFamily: 'Inter, sans-serif',
        boxShadow: '0 8px 30px rgba(15,23,42,0.055)',
        transition: 'all 0.2s ease',
        cursor: isClickable ? 'pointer' : undefined,
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '0.5px solid #E2E8F0',
            fontSize: '14px',
            fontWeight: 600,
            color: '#0F172A',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

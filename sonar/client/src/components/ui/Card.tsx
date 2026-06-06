import React from 'react'

interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  title?: string
}

export function Card({ children, style, title }: CardProps) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '0.5px solid #D0D7E3',
        borderRadius: '4px',
        fontFamily: 'Inter, sans-serif',
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '0.5px solid #D0D7E3',
            fontSize: '14px',
            fontWeight: 600,
            color: '#0A1628',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ padding: title ? '16px' : '16px' }}>{children}</div>
    </div>
  )
}

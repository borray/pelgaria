import React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: '#3B82F6',
    color: '#FFFFFF',
    border: '1px solid #3B82F6',
    boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
  },
  secondary: {
    background: '#FFFFFF',
    color: '#1B3A6B',
    border: '1px solid #D0D7E3',
  },
  danger: {
    background: '#EF4444',
    color: '#FFFFFF',
    border: '1px solid #EF4444',
  },
}

const variantHoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: '#2563EB',
    border: '1px solid #2563EB',
  },
  secondary: {
    background: '#F8FAFC',
    border: '1px solid #CBD5E1',
  },
  danger: {
    background: '#DC2626',
    border: '1px solid #DC2626',
  },
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '4px 12px', fontSize: '13px', height: '30px' },
  md: { padding: '6px 16px', fontSize: '14px', height: '36px' },
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  ...props
}: ButtonProps) {
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const btn = e.currentTarget
      Object.assign(btn.style, {
        ...variantHoverStyles[variant],
        transform: 'translateY(-1px)',
      })
    }
    onMouseEnter?.(e)
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const btn = e.currentTarget
      const base = variantStyles[variant]
      btn.style.background = base.background as string
      btn.style.border = base.border as string
      btn.style.transform = 'translateY(0)'
    }
    onMouseLeave?.(e)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      e.currentTarget.style.transform = 'translateY(0)'
    }
    onMouseDown?.(e)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      e.currentTarget.style.transform = 'translateY(-1px)'
    }
    onMouseUp?.(e)
  }

  return (
    <button
      disabled={disabled || loading}
      className={`ui-button ui-button-${variant} ui-button-${size}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        borderRadius: '10px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        transform: 'translateY(0)',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      {...props}
    >
      {loading ? 'Загрузка...' : children}
    </button>
  )
}

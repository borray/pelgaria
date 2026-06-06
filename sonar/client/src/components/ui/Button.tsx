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
    background: '#4A90D9',
    color: '#FFFFFF',
    border: '1px solid #4A90D9',
  },
  secondary: {
    background: '#FFFFFF',
    color: '#1B3A6B',
    border: '1px solid #D0D7E3',
  },
  danger: {
    background: '#DC2626',
    color: '#FFFFFF',
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
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        borderRadius: '4px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {loading ? 'Загрузка...' : children}
    </button>
  )
}

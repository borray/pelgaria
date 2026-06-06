import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, style, id, ...props }: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#374151',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={{
          height: '36px',
          padding: '0 10px',
          border: error ? '1px solid #DC2626' : '1px solid #D0D7E3',
          borderRadius: '4px',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
          color: '#1F2937',
          background: '#FFFFFF',
          outline: 'none',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span
          style={{
            fontSize: '12px',
            color: '#DC2626',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, style, id, onFocus, onBlur, ...props }: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#3B82F6'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = error ? '#EF4444' : '#D0D7E3'
    e.currentTarget.style.boxShadow = 'none'
    onBlur?.(e)
  }

  return (
    <div className="ui-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
        className="ui-input"
        id={inputId}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          height: '36px',
          padding: '0 10px',
          border: error ? '1px solid #EF4444' : '1px solid #D0D7E3',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
          color: '#1F2937',
          background: '#FFFFFF',
          outline: 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span
          style={{
            fontSize: '12px',
            color: '#EF4444',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

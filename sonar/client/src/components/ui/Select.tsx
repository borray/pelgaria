import React from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export function Select({ label, error, options, placeholder, style, id, ...props }: SelectProps) {
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label
          htmlFor={selectId}
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
      <select
        id={selectId}
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
          cursor: 'pointer',
          ...style,
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span style={{ fontSize: '12px', color: '#DC2626', fontFamily: 'Inter, sans-serif' }}>
          {error}
        </span>
      )}
    </div>
  )
}

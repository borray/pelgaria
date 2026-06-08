import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, ...props }: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  return (
    <div className={`ui-field${error ? ' has-error' : ''}`}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <input className="ui-input" id={inputId} aria-invalid={Boolean(error)} {...props} />
      {error && <span className="ui-field-error">{error}</span>}
    </div>
  )
}

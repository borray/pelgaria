import React, { useState, useRef, useEffect, useCallback } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  disabled?: boolean
  style?: React.CSSProperties
  id?: string
  name?: string
  searchable?: boolean
  searchPlaceholder?: string
}

export function Select({
  label,
  error,
  options,
  placeholder,
  value,
  onChange,
  disabled,
  style,
  id,
  name,
  searchable,
  searchPlaceholder = 'Поиск...',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder ?? '— выберите —'
  const hasValue = value !== undefined && value !== '' && value !== null

  const filteredOptions = searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const close = useCallback(() => {
    setOpen(false)
    setFocused(false)
    setQuery('')
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close()
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, close])

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 30)
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-opt]')
        if (!items) return
        const arr = Array.from(items)
        const cur = document.activeElement
        const idx = arr.indexOf(cur as HTMLButtonElement)
        const next = e.key === 'ArrowDown' ? Math.min(idx + 1, arr.length - 1) : Math.max(idx - 1, 0)
        arr[Math.max(next, 0)]?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, close])

  const pick = (val: string) => {
    const synth = {
      target: { value: val, name: name ?? '' },
      currentTarget: { value: val, name: name ?? '' },
    } as unknown as React.ChangeEvent<HTMLSelectElement>
    onChange?.(synth)
    close()
  }

  return (
    <div className={`ui-field ui-select${error ? ' has-error' : ''}${open ? ' is-open' : ''}`} style={style}>
      {label && (
        <label htmlFor={inputId}>{label}</label>
      )}

      <div ref={containerRef} className="ui-select-control">
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={() => { if (!disabled) { setOpen((v) => !v); setFocused(true) } }}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              setFocused(false)
              if (!listRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
            }
          }}
          className={`ui-select-trigger${hasValue ? ' has-value' : ''}${focused ? ' is-focused' : ''}`}
        >
          {selectedLabel}
        </button>

        <span className="ui-select-chevron">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>

        {open && (
          <div ref={listRef} className="ui-select-popover">
            {searchable && (
              <div className="ui-select-search">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                />
              </div>
            )}
            <div className="ui-select-options">
              {placeholder && !query && (
                <button data-opt="" type="button" onClick={() => pick('')} className={`ui-select-option is-placeholder${!hasValue ? ' is-active' : ''}`}>
                  {placeholder}
                </button>
              )}
              {filteredOptions.length === 0 ? (
                <div className="ui-select-empty">Ничего не найдено</div>
              ) : (
                filteredOptions.map((opt) => {
                  const active = opt.value === value
                  return (
                    <button
                      data-opt={opt.value}
                      key={opt.value}
                      type="button"
                      onClick={() => pick(opt.value)}
                      className={`ui-select-option${active ? ' is-active' : ''}`}
                    >
                      {active && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7l3.5 3.5L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {!active && <span className="ui-select-option-spacer" />}
                      {opt.label}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <span className="ui-field-error">{error}</span>
      )}
    </div>
  )
}

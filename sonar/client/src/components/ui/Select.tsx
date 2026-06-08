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

  const borderColor = error ? '#EF4444' : focused || open ? '#3B82F6' : '#D0D7E3'
  const shadow = (focused || open) && !error ? '0 0 0 3px rgba(59,130,246,0.15)' : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}
        >
          {label}
        </label>
      )}

      <div ref={containerRef} style={{ position: 'relative' }}>
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
          style={{
            width: '100%',
            height: '36px',
            padding: '0 32px 0 10px',
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            color: hasValue ? '#1F2937' : '#9CA3AF',
            background: disabled ? '#F9FAFB' : '#FFFFFF',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            boxShadow: shadow,
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {selectedLabel}
        </button>

        <span
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            pointerEvents: 'none',
            transition: 'transform 0.2s ease',
            color: '#6B7280',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>

        {open && (
          <div
            ref={listRef}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              minWidth: '100%',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.06)',
              zIndex: 2000,
              animation: 'dropdownIn 0.15s cubic-bezier(0.16,1,0.3,1) both',
              transformOrigin: 'top center',
            }}
          >
            {searchable && (
              <div style={{ padding: '8px 8px 4px' }}>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 10px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'Inter, sans-serif',
                    color: '#1F2937',
                    background: '#F8FAFC',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6'
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>
            )}
            <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
              {placeholder && !query && (
                <button data-opt="" type="button" onClick={() => pick('')} style={optStyle(!hasValue, true)}>
                  {placeholder}
                </button>
              )}
              {filteredOptions.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
                  Ничего не найдено
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const active = opt.value === value
                  return (
                    <button
                      data-opt={opt.value}
                      key={opt.value}
                      type="button"
                      onClick={() => pick(opt.value)}
                      style={optStyle(active, false)}
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#F5F9FF'
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      }}
                    >
                      {active && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginRight: 6 }}>
                          <path d="M2.5 7l3.5 3.5L11.5 4" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {!active && <span style={{ width: 20, flexShrink: 0 }} />}
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
        <span style={{ fontSize: '12px', color: '#EF4444', fontFamily: 'Inter, sans-serif' }}>
          {error}
        </span>
      )}
    </div>
  )
}

function optStyle(active: boolean, muted: boolean): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    color: muted ? '#9CA3AF' : active ? '#1B3A6B' : '#1F2937',
    background: active ? '#EFF6FF' : 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: active ? 500 : 400,
    outline: 'none',
    transition: 'background 0.1s ease',
  }
}

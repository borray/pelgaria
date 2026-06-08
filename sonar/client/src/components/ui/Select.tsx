import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { IconCheck, IconChevronDown, IconSearch } from '@tabler/icons-react'

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
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
  disabled?: boolean
  style?: CSSProperties
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
  searchPlaceholder = 'Поиск',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  const selected = options.find((option) => option.value === value)
  const filtered = query
    ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    if (searchable) window.setTimeout(() => searchRef.current?.focus(), 20)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open, searchable])

  const pick = (nextValue: string) => {
    onChange?.({
      target: { value: nextValue, name: name ?? '' },
      currentTarget: { value: nextValue, name: name ?? '' },
    } as unknown as ChangeEvent<HTMLSelectElement>)
    close()
  }

  return (
    <div className={`ui-field ui-select${error ? ' has-error' : ''}`} style={style} ref={rootRef}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <button
        id={inputId}
        type="button"
        className={`ui-select-trigger${open ? ' is-open' : ''}`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className={selected ? '' : 'is-placeholder'}>{selected?.label ?? placeholder ?? 'Выберите значение'}</span>
        <IconChevronDown size={16} />
      </button>
      {open && (
        <div className="ui-select-menu">
          {searchable && (
            <label className="ui-select-search">
              <IconSearch size={15} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
          )}
          <div className="ui-select-options">
            {placeholder && (
              <button type="button" className={!value ? 'is-selected' : ''} onClick={() => pick('')}>
                <span>{placeholder}</span>
                {!value && <IconCheck size={15} />}
              </button>
            )}
            {filtered.map((option) => (
              <button
                type="button"
                key={option.value}
                className={option.value === value ? 'is-selected' : ''}
                onClick={() => pick(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value && <IconCheck size={15} />}
              </button>
            ))}
            {filtered.length === 0 && <div className="ui-select-empty">Ничего не найдено</div>}
          </div>
        </div>
      )}
      {error && <span className="ui-field-error">{error}</span>}
    </div>
  )
}

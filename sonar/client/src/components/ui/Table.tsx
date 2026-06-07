import React from 'react'

export interface TableColumn<T> {
  key: string
  header: string
  width?: string
  render?: (row: T) => React.ReactNode
}

interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  keyExtractor: (row: T) => string
  loading?: boolean
}

export function Table<T>({ columns, data, onRowClick, keyExtractor, loading }: TableProps<T>) {
  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
        Загрузка...
      </div>
    )
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        background: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
        }}
      >
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#475569',
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              style={{
                borderBottom: '1px solid #F1F5F9',
                cursor: onRowClick ? 'pointer' : 'default',
                background: '#FFFFFF',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (onRowClick) {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = '#F5F9FF'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLTableRowElement).style.background = '#FFFFFF'
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '10px 16px',
                    color: '#374151',
                    verticalAlign: 'middle',
                  }}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

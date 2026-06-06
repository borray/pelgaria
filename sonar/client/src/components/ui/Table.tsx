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
        border: '0.5px solid #D0D7E3',
        borderRadius: '4px',
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
          <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #D0D7E3' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '13px',
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
                borderBottom: '0.5px solid #D0D7E3',
                cursor: onRowClick ? 'pointer' : 'default',
                background: '#FFFFFF',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (onRowClick) {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = '#F8F9FB'
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

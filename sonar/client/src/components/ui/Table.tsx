import type { ReactNode } from 'react'
import { TableSkeleton } from './Skeleton'

export interface TableColumn<T> {
  key: string
  header: string
  width?: string
  render?: (row: T) => ReactNode
}

interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  keyExtractor: (row: T) => string
  loading?: boolean
}

export function Table<T>({ columns, data, onRowClick, keyExtractor, loading }: TableProps<T>) {
  if (loading) return <TableSkeleton rows={5} cols={columns.length} />

  return (
    <div className="ui-table-shell">
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width }}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              className={onRowClick ? 'is-clickable' : undefined}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td key={column.key} data-label={column.header}>
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

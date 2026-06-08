interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{
      border: '1px solid #DFE4E1', borderRadius: 12, background: '#fff',
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 0, background: '#F8F9F7', borderBottom: '1px solid #DFE4E1',
        padding: '12px 16px',
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} width="60%" borderRadius={4} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
            padding: '12px 16px', gap: 0,
            borderBottom: r < rows - 1 ? '1px solid #F5F6F3' : 'none',
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} width={c === 0 ? '40%' : '70%'} borderRadius={4} />
          ))}
        </div>
      ))}
    </div>
  )
}

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
    <div className="table-skeleton">
      <div className="table-skeleton-head" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} width="60%" borderRadius={4} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="table-skeleton-row"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} width={c === 0 ? '40%' : '70%'} borderRadius={4} />
          ))}
        </div>
      ))}
    </div>
  )
}

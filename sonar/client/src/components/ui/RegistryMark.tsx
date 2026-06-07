import { useMemo } from 'react'

interface RegistryMarkProps {
  code?: string | null
  compact?: boolean
}

function barsFor(value: string): number[] {
  let state = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    state ^= value.charCodeAt(i)
    state = Math.imul(state, 16777619)
  }
  const bars: number[] = [2, 1, 2, 2]
  for (let i = 0; i < 34; i += 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    bars.push(1 + (Math.abs(state) % 3))
  }
  return [...bars, 3, 1, 2]
}

export function RegistryMark({ code, compact = false }: RegistryMarkProps) {
  const label = code || 'ШК формируется'
  const bars = useMemo(() => barsFor(label), [label])
  let x = 0
  const rects = bars.map((width, index) => {
    const currentX = x
    x += width + (index % 2 === 0 ? 1 : 2)
    return index % 2 === 0
      ? <rect key={index} x={currentX} y="0" width={width} height="22" rx="0.2" />
      : null
  })

  return (
    <span className={`registry-mark${compact ? ' is-compact' : ''}`} title={label}>
      <svg viewBox={`0 0 ${x} 22`} preserveAspectRatio="none" aria-hidden="true">{rects}</svg>
      <span>{label}</span>
    </span>
  )
}

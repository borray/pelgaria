import { SonarMark } from './SonarMark'

interface SonarBrandProps {
  compact?: boolean
  light?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SonarBrand({ compact = false, light = false, size = 'md' }: SonarBrandProps) {
  return (
    <div className={`sonar-brand sonar-brand-${size}${light ? ' is-light' : ''}`}>
      <span className="sonar-brand-mark" aria-hidden="true">
        <SonarMark />
      </span>
      {!compact && (
        <span className="sonar-brand-copy">
          <strong>СОНАР</strong>
          <small>Пельгария</small>
        </span>
      )}
    </div>
  )
}

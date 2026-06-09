interface SonarBrandProps {
  compact?: boolean
  light?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SonarBrand({ compact = false, light = false, size = 'md' }: SonarBrandProps) {
  return (
    <div className={`sonar-brand sonar-brand-${size}${light ? ' is-light' : ''}`}>
      <span className="sonar-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <path d="M10 24.5V11.8c0-1 .8-1.8 1.8-1.8H25" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14.2 25.8V15.2c0-.55.45-1 1-1h10.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
          <circle cx="23.5" cy="23.5" r="3.5" fill="currentColor" />
        </svg>
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

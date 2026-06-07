interface SonarBrandProps {
  compact?: boolean
  light?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SonarBrand({ compact = false, light = false, size = 'md' }: SonarBrandProps) {
  return (
    <div className={`sonar-brand sonar-brand-${size}${light ? ' is-light' : ''}`}>
      <svg className="sonar-brand-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="46" height="46" rx="14" fill="currentColor" fillOpacity="0.08" />
        <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="1.5" opacity="0.34" />
        <circle cx="24" cy="24" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.58" />
        <path d="M24 24 35.5 13.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M24 9a15 15 0 0 1 15 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3.2" fill="currentColor" />
        <circle cx="36" cy="13" r="2.3" fill="currentColor" />
      </svg>
      {!compact && (
        <div className="sonar-brand-copy">
          <strong>СОНАР</strong>
          <span>Государственная система</span>
        </div>
      )}
    </div>
  )
}

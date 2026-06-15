import { useId } from 'react'

type SonarMarkProps = {
  className?: string
  title?: string
}

export function SonarMark({ className, title }: SonarMarkProps) {
  const maskId = `sonar-cut-${useId().replace(/:/g, '')}`

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          <path
            d="M6 43Q31 8 58 39"
            fill="none"
            stroke="#000"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </mask>
      </defs>
      <path
        className="sonar-mark-orbit"
        d="M9 50Q32 22 56 47"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".22"
      />
      <path
        d="M28 8H36V16H44V24H52V32H44V40H36V48H28V40H20V32H12V24H20V16H28Z"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
      <path
        className="sonar-mark-scan"
        d="M6 43Q31 8 58 39"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle className="sonar-mark-pulse" cx="58" cy="39" r="2.7" fill="currentColor" />
    </svg>
  )
}

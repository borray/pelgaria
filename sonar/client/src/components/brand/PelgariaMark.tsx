type PelgariaMarkProps = {
  className?: string
  title?: string
}

export function PelgariaMark({ className, title }: PelgariaMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path
        d="M58 348h396M150 348V176M362 348V176M128 196h44M340 196h44"
        fill="none"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M58 286Q104 176 150 176Q256 308 362 176Q408 176 454 286"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M92 238v110M122 190v158M194 223v125M226 269v79M286 269v79M318 223v125M390 190v158M420 238v110"
        fill="none"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="m422 92 11 20 20 11-20 11-11 20-11-20-20-11 20-11 11-20Z"
        fill="currentColor"
      />
    </svg>
  )
}

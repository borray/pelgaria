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
        d="M113 356V226l43-34v164M399 356V226l-43-34v164"
        fill="none"
        stroke="currentColor"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M156 240c49-76 151-76 200 0M84 356h344"
        fill="none"
        stroke="currentColor"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <path
        d="M256 356V245"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="m256 130 14 25 25 14-25 14-14 25-14-25-25-14 25-14 14-25Z"
        fill="currentColor"
      />
    </svg>
  )
}

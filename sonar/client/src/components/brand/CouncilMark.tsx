type CouncilMarkProps = {
  className?: string
  title?: string
}

export function CouncilMark({ className, title }: CouncilMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      {title && <title>{title}</title>}
      <path d="M12 47H52M18 43V25L32 15L46 25V43M25 43V31H39V43M9 51H55" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 8V12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

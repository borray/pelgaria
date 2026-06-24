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
      <circle cx="256" cy="256" r="172" fill="none" stroke="currentColor" strokeWidth="34" />
      <path d="M94 256H418M256 84C306 132 334 190 334 256C334 322 306 380 256 428M256 84C206 132 178 190 178 256C178 322 206 380 256 428" fill="none" stroke="currentColor" strokeWidth="28" strokeLinecap="round" />
      <path d="M121 176C161 201 207 214 256 214C305 214 351 201 391 176M121 336C161 311 207 298 256 298C305 298 351 311 391 336" fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" />
    </svg>
  )
}

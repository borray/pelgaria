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
        d="M224 96H288V160H352V224H416V288H352V352H288V416H224V352H160V288H96V224H160V160H224Z"
        fill="currentColor"
      />
    </svg>
  )
}

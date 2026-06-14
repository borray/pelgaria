import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  meta?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions, meta }: PageHeaderProps) {
  return (
    <header className="workspace-heading">
      <div className="workspace-heading-copy">
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {meta && <div className="workspace-heading-meta">{meta}</div>}
      </div>
      {actions && <div className="workspace-heading-actions">{actions}</div>}
    </header>
  )
}

export function RegistryToolbar({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  return (
    <div className="registry-toolbar">
      <div className="registry-toolbar-controls">{children}</div>
      {summary && <div className="registry-toolbar-summary">{summary}</div>}
    </div>
  )
}

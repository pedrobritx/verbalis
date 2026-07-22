import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1 min-w-0">
        <h1
          className="text-large-title font-bold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </header>
  )
}

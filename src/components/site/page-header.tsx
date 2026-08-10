import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Standard title band used by the listing routes. */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('border-b border-border bg-surface text-surface-foreground', className)}>
      <div className="container-page flex flex-col gap-4 py-10 md:py-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-title">{title}</h1>
          {subtitle ? <p className="max-w-2xl text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </header>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-muted-foreground">
      {message}
    </div>
  )
}

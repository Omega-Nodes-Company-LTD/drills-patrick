import type { CSSProperties, ReactNode } from 'react'
import type { BlockLayout } from '@/lib/blocks/schema'
import { cn } from '@/lib/utils'

/**
 * Applies a block's layout props. Spacing values resolve to the CSS variables
 * produced by the theme, so an operator changing the "large section spacing"
 * token in the admin moves every section that uses it.
 */

const toneClasses: Record<NonNullable<BlockLayout['tone']>, string> = {
  default: 'bg-background text-foreground',
  surface: 'bg-surface text-surface-foreground',
  muted: 'bg-muted text-foreground',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent text-accent-foreground',
}

const widthClasses: Record<NonNullable<BlockLayout['width']>, string> = {
  narrow: 'container-narrow',
  container: 'container-page',
  wide: 'container-wide',
  full: 'w-full',
}

export function Section({
  layout,
  children,
  className,
  innerClassName,
}: {
  layout: BlockLayout
  children: ReactNode
  className?: string
  innerClassName?: string
}) {
  const style: CSSProperties = {
    paddingTop: `var(--section-y-${layout.paddingTop})`,
    paddingBottom: `var(--section-y-${layout.paddingBottom})`,
    ...(layout.background ? { backgroundColor: layout.background } : {}),
  }

  return (
    <section
      id={layout.anchor || undefined}
      style={style}
      className={cn(layout.background ? undefined : toneClasses[layout.tone], className)}
    >
      <div className={cn(widthClasses[layout.width], innerClassName)}>{children}</div>
    </section>
  )
}

/** Heading pair shared by most blocks. */
export function SectionHeading({
  title,
  subtitle,
  align = 'left',
  className,
}: {
  title?: string
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
}) {
  if (!title && !subtitle) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className,
      )}
    >
      {title ? <h2 className="text-title">{title}</h2> : null}
      {subtitle ? (
        <p className={cn('max-w-2xl text-base opacity-80', align === 'center' && 'mx-auto')}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

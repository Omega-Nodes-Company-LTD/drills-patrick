import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Sticky save bar for the long admin forms, shown below `lg` only.
 *
 * From `lg` upwards these forms put their status controls and the save button
 * in a sticky side rail. On a phone that rail collapses to the very bottom of
 * the page — behind five languages' worth of fields, a rich-text editor and the
 * SEO panel — so saving means scrolling past everything first. This keeps the
 * same controls within reach without changing the desktop layout.
 *
 * Rendered inside the `<form>`, so a `type="submit"` button placed here submits
 * it in the normal way despite being positioned out of flow. `AdminShell` pads
 * its `<main>` by the height of this bar, so nothing ends up underneath it.
 */
export function FormActionBar({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden',
        className,
      )}
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
      {...props}
    >
      {children}
    </div>
  )
}

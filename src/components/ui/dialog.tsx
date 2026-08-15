'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = ({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn('text-subheading font-semibold', className)} {...props} />
)
export const DialogDescription = ({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)

/**
 * Where the panel is anchored. `bottom` is the default sheet-then-dialog used
 * by every form in the admin; `start` and `end` produce a full-height edge
 * drawer — the shape the site and admin navigation need — at every width.
 */
export type DialogSide = 'bottom' | 'start' | 'end'

const sideClasses: Record<DialogSide, string> = {
  // Full-height sheet on phones, centred dialog from `sm` upwards.
  bottom:
    'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-xl)] ' +
    'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(46rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-xl)]',
  start: 'inset-y-0 start-0 h-dvh w-[min(20rem,88vw)] border-s-0',
  end: 'inset-y-0 end-0 h-dvh w-[min(20rem,88vw)] border-e-0',
}

export function DialogContent({
  className,
  children,
  closeLabel = 'Close',
  side = 'bottom',
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel?: string
  side?: DialogSide
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden border border-border bg-background shadow-token-lg',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          // Grown rather than given a `touch-target` hit area: that utility sets
          // `position: relative`, which would undo the `absolute` this button
          // needs. There is room in the corner for the larger box.
          className="absolute end-3 top-3 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors pointer-coarse:size-11 hover:bg-muted hover:text-foreground"
          aria-label={closeLabel}
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 border-b border-border p-5', className)} {...props} />
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex-1 overflow-y-auto p-5', className)} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

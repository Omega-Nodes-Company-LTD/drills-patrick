import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[color,background-color,border-color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:brightness-110 shadow-token',
        secondary: 'bg-secondary text-secondary-foreground hover:brightness-110',
        accent: 'bg-accent text-accent-foreground hover:brightness-105',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground',
        ghost: 'bg-transparent text-foreground hover:bg-muted',
        danger: 'bg-danger text-white hover:brightness-110',
        link: 'bg-transparent text-primary underline underline-offset-4 hover:brightness-110',
      },
      size: {
        sm: 'h-9 rounded-[var(--radius-sm)] px-3 text-sm [&_svg]:size-4',
        md: 'h-11 rounded-[var(--radius-md)] px-5 text-base [&_svg]:size-4',
        lg: 'h-13 rounded-[var(--radius-md)] px-7 text-base [&_svg]:size-5',
        icon: 'size-10 rounded-[var(--radius-md)] [&_svg]:size-4',
        iconSm: 'size-8 rounded-[var(--radius-sm)] [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }

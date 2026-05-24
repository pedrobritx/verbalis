import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:opacity-80',
  {
    variants: {
      variant: {
        filled:
          'bg-[var(--color-accent)] text-white shadow-sm hover:opacity-90',
        tinted:
          'bg-[var(--color-accent-fill)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)]',
        gray:
          'bg-[var(--color-fill)] text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-text)_10%,transparent)]',
        bordered:
          'border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-fill)]',
        plain:
          'bg-transparent text-[var(--color-accent)] hover:bg-[var(--color-fill)]',
        destructive:
          'bg-[var(--color-error)] text-white shadow-sm hover:opacity-90',
        link:
          'text-[var(--color-accent)] underline-offset-4 hover:underline',
      },
      size: {
        md: 'h-11 px-4 text-callout [&_svg]:size-[18px]',
        sm: 'h-9 px-3 text-footnote [&_svg]:size-4',
        lg: 'h-12 px-6 text-body [&_svg]:size-5',
        icon: 'h-11 w-11 [&_svg]:size-5',
        'icon-sm': 'h-9 w-9 [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'filled',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }

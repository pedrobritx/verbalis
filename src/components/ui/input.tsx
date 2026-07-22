import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-md border bg-transparent px-3 py-2 text-callout transition-colors',
          'placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-callout file:font-medium file:text-foreground',
          className,
        )}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }

import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[2.75rem] w-full rounded-md border bg-transparent px-3 py-2 text-callout transition-colors resize-y',
        'placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }

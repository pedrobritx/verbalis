import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[2.5rem] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors resize-y',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
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

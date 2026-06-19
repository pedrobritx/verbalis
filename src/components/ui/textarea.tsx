import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Grow the textarea to fit its content (no scrollbar, no manual drag) so the
   * whole text stays visible — used by the translation grid so a long target
   * can be compared against the source at a glance.
   */
  autoResize?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize, value, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

    const setRefs = React.useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      },
      [ref],
    )

    const fit = React.useCallback(() => {
      const el = innerRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [])

    // Re-fit on content changes.
    React.useLayoutEffect(() => {
      if (autoResize) fit()
    }, [autoResize, value, fit])

    // Re-fit when the available width changes (panel toggle, window resize),
    // which rewraps the text. Guarded for environments without ResizeObserver.
    React.useEffect(() => {
      const el = innerRef.current
      if (!autoResize || !el || typeof ResizeObserver === 'undefined') return
      let lastWidth = el.clientWidth
      const ro = new ResizeObserver(() => {
        if (el.clientWidth !== lastWidth) {
          lastWidth = el.clientWidth
          fit()
        }
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [autoResize, fit])

    return (
      <textarea
        ref={setRefs}
        value={value}
        className={cn(
          'flex min-h-[2.75rem] w-full rounded-md border bg-transparent px-3 py-2 text-callout transition-colors resize-y',
          'placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          autoResize && 'resize-none overflow-hidden',
          className,
        )}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }

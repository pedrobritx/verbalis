import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Languages, X } from 'lucide-react'
import { TranslateWorkspace } from '@/features/translate/TranslateWorkspace'
import { useQuickLookupStore } from './useQuickLookupStore'

export function QuickLookupDialog() {
  const open = useQuickLookupStore((s) => s.open)
  const prefill = useQuickLookupStore((s) => s.prefill)
  const sourceLang = useQuickLookupStore((s) => s.sourceLang)
  const targetLang = useQuickLookupStore((s) => s.targetLang)
  const setOpen = useQuickLookupStore((s) => s.setOpen)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-testid="quick-lookup-dialog"
          className="fixed z-50 flex flex-col border shadow-2xl
            inset-x-0 bottom-0 rounded-t-xl
            md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2
            md:w-[min(640px,92vw)] md:rounded-lg md:border
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom
            md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95
            md:data-[state=closed]:slide-out-to-top-[48%] md:data-[state=open]:slide-in-from-top-[48%]"
          style={{
            background: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            maxHeight: '90dvh',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <DialogPrimitive.Title
              className="flex items-center gap-2 text-headline font-semibold"
              style={{ color: 'var(--color-text)' }}
            >
              <Languages size={18} />
              Quick lookup
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[var(--color-fill)]"
              style={{ color: 'var(--color-muted)' }}
            >
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <TranslateWorkspace
              active={open}
              prefill={prefill}
              initialSourceLang={sourceLang}
              initialTargetLang={targetLang}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

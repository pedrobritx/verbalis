import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { SidebarPanel } from './SidebarPanel'

interface MobileSidebarSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  focusedSource: string | undefined
  focusedTarget: string | undefined
  focusedSegmentId: string | undefined
  projectId: string
  sourceLang: string
  targetLang: string
  onApplyTM: (target: string) => void
  onInsertGlossary: (text: string) => void
  onApplyMT: (target: string) => void
}

export function MobileSidebarSheet({
  open,
  onOpenChange,
  focusedSource,
  focusedTarget,
  focusedSegmentId,
  projectId,
  sourceLang,
  targetLang,
  onApplyTM,
  onInsertGlossary,
  onApplyMT,
}: MobileSidebarSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-xl border-t shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
          style={{
            background: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            maxHeight: '85dvh',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <DialogPrimitive.Title
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text)' }}
            >
              Tools
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close tools"
              className="p-1.5 rounded transition-colors hover:opacity-70"
              style={{ color: 'var(--color-muted)' }}
            >
              <X size={16} />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <SidebarPanel
              focusedSource={focusedSource}
              focusedTarget={focusedTarget}
              focusedSegmentId={focusedSegmentId}
              projectId={projectId}
              sourceLang={sourceLang}
              targetLang={targetLang}
              onApplyTM={onApplyTM}
              onInsertGlossary={onInsertGlossary}
              onApplyMT={onApplyMT}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

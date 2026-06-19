import { useEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type TextFormatType,
} from 'lexical'
import { Bold, Italic, Underline, Superscript, Subscript, CaseUpper } from 'lucide-react'
import { transformCase, CASE_LABELS, type CaseTransform } from '@/core/text/case'
import { cn } from '@/lib/utils'

interface MarkButton {
  format: TextFormatType
  label: string
  icon: React.ReactNode
}

const MARKS: MarkButton[] = [
  { format: 'bold', label: 'Bold (Ctrl+B)', icon: <Bold size={14} /> },
  { format: 'italic', label: 'Italic (Ctrl+I)', icon: <Italic size={14} /> },
  { format: 'underline', label: 'Underline (Ctrl+U)', icon: <Underline size={14} /> },
  { format: 'superscript', label: 'Superscript', icon: <Superscript size={14} /> },
  { format: 'subscript', label: 'Subscript', icon: <Subscript size={14} /> },
]

const CASE_MODES: CaseTransform[] = ['upper', 'lower', 'title', 'sentence']

type ActiveFormats = Record<string, boolean>

export function FormatToolbar() {
  const [editor] = useLexicalComposerContext()
  const [active, setActive] = useState<ActiveFormats>({})
  const [caseOpen, setCaseOpen] = useState(false)
  const caseRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection()
        if ($isRangeSelection(sel)) {
          setActive({
            bold: sel.hasFormat('bold'),
            italic: sel.hasFormat('italic'),
            underline: sel.hasFormat('underline'),
            subscript: sel.hasFormat('subscript'),
            superscript: sel.hasFormat('superscript'),
          })
        }
      })
    })
  }, [editor])

  useEffect(() => {
    if (!caseOpen) return
    const onDown = (e: PointerEvent) => {
      if (caseRef.current && !caseRef.current.contains(e.target as Node)) setCaseOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [caseOpen])

  const applyCase = (mode: CaseTransform) => {
    setCaseOpen(false)
    editor.update(() => {
      const sel = $getSelection()
      if ($isRangeSelection(sel) && !sel.isCollapsed()) {
        sel.insertText(transformCase(sel.getTextContent(), mode))
      }
    })
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-md border p-0.5 w-fit"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      data-testid="format-toolbar"
      // Keep the editor selection alive when clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
    >
      {MARKS.map((m) => (
        <button
          key={m.format}
          type="button"
          aria-label={m.label}
          aria-pressed={!!active[m.format]}
          title={m.label}
          data-testid={`format-${m.format}`}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, m.format)}
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded transition-colors hover:bg-[var(--color-fill)]',
          )}
          style={{
            color: active[m.format] ? 'var(--color-accent)' : 'var(--color-muted)',
            background: active[m.format] ? 'var(--color-accent-fill)' : 'transparent',
          }}
        >
          {m.icon}
        </button>
      ))}

      <div className="relative" ref={caseRef}>
        <button
          type="button"
          aria-label="Change case"
          aria-haspopup="menu"
          aria-expanded={caseOpen}
          title="Change case"
          data-testid="format-case"
          onClick={() => setCaseOpen((v) => !v)}
          className="inline-flex items-center justify-center w-7 h-7 rounded transition-colors hover:bg-[var(--color-fill)]"
          style={{ color: 'var(--color-muted)' }}
        >
          <CaseUpper size={15} />
        </button>
        {caseOpen && (
          <div
            role="menu"
            data-testid="format-case-menu"
            className="absolute left-0 z-30 mt-1 min-w-[9rem] rounded-md border p-1 shadow-md"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            {CASE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="menuitem"
                data-testid={`format-case-${mode}`}
                onClick={() => applyCase(mode)}
                className="flex w-full items-center rounded px-2 py-1.5 text-sm text-left transition-colors hover:bg-[var(--color-fill)]"
                style={{ color: 'var(--color-text)' }}
              >
                {CASE_LABELS[mode]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

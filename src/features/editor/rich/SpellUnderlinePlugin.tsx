import { useEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey, $getRoot, $isTextNode } from 'lexical'
import { getSpellWorker } from '@/workers/client'
import { resolveSpellLang } from '@/core/spell/dictionaries'
import { ensureDictionaryLoaded } from '@/core/spell/loader'
import { tokenizeWords } from '@/core/spell/tokenize'
import { mapTokenToNode, type NodeSpan } from '@/core/spell/offsets'

const DEBOUNCE_MS = 400

interface Underline {
  left: number
  top: number
  width: number
  height: number
  word: string
  key: string
  localStart: number
  localEnd: number
}

interface Popover {
  left: number
  top: number
  word: string
  key: string
  localStart: number
  localEnd: number
  suggestions: string[]
}

/**
 * Non-mutating spell-check underlines for the rich editor. Paints a wavy
 * underline layer over the ContentEditable from worker-checked tokens — it never
 * touches the editor node tree (so typing/IME/undo and the `{id}` contract are
 * untouched). All DOM measurement is guarded; on any failure it simply renders
 * nothing. Browser-only behaviour — the pure offset mapping is in core/spell.
 */
export function SpellUnderlinePlugin({
  targetLang,
  containerRef,
}: {
  targetLang: string
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [editor] = useLexicalComposerContext()
  const lang = resolveSpellLang(targetLang)
  const [underlines, setUnderlines] = useState<Underline[]>([])
  const [popover, setPopover] = useState<Popover | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    if (!lang) return
    ensureDictionaryLoaded(lang).then(
      () => {
        readyRef.current = true
      },
      () => {},
    )
  }, [lang])

  useEffect(() => {
    if (!lang) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const recompute = async () => {
      try {
        if (!readyRef.current) {
          await ensureDictionaryLoaded(lang)
          readyRef.current = true
        }
        const plain = editor.getEditorState().read(() => $getRoot().getTextContent())
        const tokens = tokenizeWords(plain)
        if (tokens.length === 0) {
          if (!cancelled) setUnderlines([])
          return
        }
        const unique = Array.from(new Set(tokens.map((t) => t.word)))
        const misspelled = new Set(await getSpellWorker().checkMany(lang, unique))
        const bad = tokens.filter((t) => misspelled.has(t.word))
        const container = containerRef.current
        if (bad.length === 0 || !container) {
          if (!cancelled) setUnderlines([])
          return
        }

        // Ordered leaf spans of the single paragraph, with plain-text lengths.
        const spans: NodeSpan[] = []
        editor.getEditorState().read(() => {
          const para = $getRoot().getFirstChild()
          const children =
            para && 'getChildren' in para ? (para as { getChildren: () => unknown[] }).getChildren() : []
          for (const child of children as Array<{ getKey: () => string; getTextContent: () => string }>) {
            spans.push({
              key: child.getKey(),
              length: child.getTextContent().length,
              isText: $isTextNode(child as never),
            })
          }
        })

        const crect = container.getBoundingClientRect()
        const next: Underline[] = []
        for (const t of bad) {
          const mapped = mapTokenToNode(spans, t.start, t.end)
          if (!mapped) continue
          const el = editor.getElementByKey(mapped.key)
          const domText = el?.firstChild
          if (!domText || domText.nodeType !== Node.TEXT_NODE) continue
          const range = document.createRange()
          range.setStart(domText, mapped.localStart)
          range.setEnd(domText, mapped.localEnd)
          for (const r of Array.from(range.getClientRects())) {
            next.push({
              left: r.left - crect.left,
              top: r.top - crect.top,
              width: r.width,
              height: r.height,
              word: t.word,
              key: mapped.key,
              localStart: mapped.localStart,
              localEnd: mapped.localEnd,
            })
          }
        }
        if (!cancelled) setUnderlines(next)
      } catch {
        if (!cancelled) setUnderlines([])
      }
    }

    const schedule = () => {
      if (editor.isComposing()) return
      clearTimeout(timer)
      timer = setTimeout(recompute, DEBOUNCE_MS)
    }
    const unregister = editor.registerUpdateListener(schedule)
    timer = setTimeout(recompute, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
      unregister()
    }
  }, [editor, lang, containerRef])

  async function openPopover(u: Underline) {
    if (!lang) return
    const suggestions = (await getSpellWorker().suggest(lang, u.word)).slice(0, 6)
    setPopover({
      left: u.left,
      top: u.top + u.height + 2,
      word: u.word,
      key: u.key,
      localStart: u.localStart,
      localEnd: u.localEnd,
      suggestions,
    })
  }

  function applyFix(p: Popover, replacement: string) {
    editor.update(() => {
      const node = $getNodeByKey(p.key)
      if ($isTextNode(node)) {
        try {
          node.spliceText(p.localStart, p.localEnd - p.localStart, replacement, true)
        } catch {
          // Stale offsets (edited since) — ignore rather than corrupt the text.
        }
      }
    })
    setPopover(null)
  }

  if (!lang) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {underlines.map((u, i) => (
        <button
          key={`${u.key}-${u.localStart}-${i}`}
          type="button"
          className="rsg-spell-error pointer-events-auto absolute"
          style={{ left: u.left, top: u.top, width: u.width, height: u.height }}
          title={`“${u.word}” — possible spelling mistake`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void openPopover(u)}
          data-testid="spell-underline"
        />
      ))}
      {popover && (
        <div
          className="pointer-events-auto absolute z-30 flex flex-col rounded-md border p-1 shadow-md"
          style={{
            left: popover.left,
            top: popover.top,
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            minWidth: '8rem',
          }}
          data-testid="spell-underline-popover"
          onMouseDown={(e) => e.preventDefault()}
        >
          {popover.suggestions.length === 0 ? (
            <span className="px-2 py-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              No suggestions
            </span>
          ) : (
            popover.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded px-2 py-1 text-left text-sm transition-colors hover:bg-[var(--color-fill)]"
                style={{ color: 'var(--color-text)' }}
                onClick={() => applyFix(popover, s)}
              >
                {s}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

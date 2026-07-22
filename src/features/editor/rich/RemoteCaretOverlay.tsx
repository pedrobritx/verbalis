import { useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot } from 'lexical'
import { mapOffsetToNode } from '@/core/spell/offsets'
import { usePresenceStore } from '../peers/usePresenceStore'
import { buildLeafSpans } from './richOffsets'
import { PEER_NAME_FALLBACK } from '@/features/account/displayName'

/**
 * Live remote cursors for the rich target editor (ROADMAP §4.4.1).
 *
 * Paints a coloured caret + name label for each remote peer whose presence has
 * them on this segment, positioned from their reported plain-text caret offset
 * via the same offset→DOM mapping the spell overlay uses. Like that overlay it
 * never mutates the editor node tree (so typing/IME/undo and the `{id}` contract
 * are untouched) and every DOM measurement is guarded — on any failure it simply
 * renders nothing. Browser-only; the pure offset mapping lives in core/features.
 */

interface CaretPaint {
  peerId: string
  name: string
  color: string
  left: number
  top: number
  height: number
}

export function RemoteCaretOverlay({
  segmentId,
  containerRef,
}: {
  segmentId: string
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [editor] = useLexicalComposerContext()
  const peers = usePresenceStore((s) => s.peers)
  const [carets, setCarets] = useState<CaretPaint[]>([])

  // Remote peers on this segment that have a caret, plus a stable key so the
  // effect only re-subscribes when their identity or caret position changes.
  const remotes = peers.filter((p) => p.activeSegmentId === segmentId && p.caret)
  const remotesKey = remotes
    .map((p) => `${p.peerId}:${p.caret!.anchor}:${p.caret!.focus}:${p.color}:${p.displayName}`)
    .join('|')

  useEffect(() => {
    if (remotes.length === 0) {
      setCarets([])
      return
    }
    let frame = 0
    const recompute = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        try {
          const container = containerRef.current
          if (!container) return
          const spans = editor
            .getEditorState()
            .read(() => buildLeafSpans($getRoot().getFirstChild()))
          const crect = container.getBoundingClientRect()
          const next: CaretPaint[] = []
          for (const p of remotes) {
            const mapped = mapOffsetToNode(spans, p.caret!.focus)
            if (!mapped) continue
            const el = editor.getElementByKey(mapped.key)
            const domText = el?.firstChild
            if (!domText || domText.nodeType !== Node.TEXT_NODE) continue
            const off = Math.min(mapped.localOffset, domText.textContent?.length ?? 0)
            const range = document.createRange()
            range.setStart(domText, off)
            range.setEnd(domText, off)
            const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
            next.push({
              peerId: p.peerId,
              name: p.displayName || PEER_NAME_FALLBACK,
              color: p.color,
              left: rect.left - crect.left,
              top: rect.top - crect.top,
              height: rect.height || 16,
            })
          }
          setCarets(next)
        } catch {
          setCarets([])
        }
      })
    }

    // Recompute on any editor change (text edits shift caret positions) and once now.
    const unregister = editor.registerUpdateListener(recompute)
    recompute()
    return () => {
      cancelAnimationFrame(frame)
      unregister()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, containerRef, remotesKey])

  if (carets.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
      data-testid="remote-carets"
    >
      {carets.map((c) => (
        <div
          key={c.peerId}
          className="absolute"
          style={{ left: c.left, top: c.top, height: c.height }}
          data-testid="remote-caret"
        >
          <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: c.color }} />
          <span
            className="absolute -top-4 left-0 whitespace-nowrap rounded px-1 text-[10px] font-semibold leading-tight text-white"
            style={{ background: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  $createTextNode,
  FORMAT_TEXT_COMMAND,
  type LexicalNode,
  type TextFormatType,
} from 'lexical'
import {
  Bold,
  Italic,
  Underline,
  Superscript,
  Subscript,
  CaseUpper,
  Link as LinkIcon,
  MessageSquarePlus,
} from 'lucide-react'
import { transformCase, CASE_LABELS, type CaseTransform } from '@/core/text/case'
import { cn } from '@/lib/utils'
import { $createLinkNode, $isLinkNode, LinkNode } from './LinkNode'
import { $wrapSelectionAsComment, $removeCommentMarkByAnchor } from './comments'
import { addRootComment } from '../comments/commentOps'

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

/** Walk up from a node to the nearest enclosing link, if any. */
function $linkAncestor(node: LexicalNode | null): LinkNode | null {
  let n: LexicalNode | null = node
  while (n) {
    if ($isLinkNode(n)) return n
    n = n.getParent()
  }
  return null
}

export function FormatToolbar({
  segmentId,
  commentAuthor,
}: {
  segmentId?: string
  commentAuthor?: string
}) {
  const [editor] = useLexicalComposerContext()
  const [active, setActive] = useState<ActiveFormats>({})
  const [hasRange, setHasRange] = useState(false)
  const [caseOpen, setCaseOpen] = useState(false)
  const caseRef = useRef<HTMLDivElement | null>(null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [editingLink, setEditingLink] = useState(false)
  const linkRef = useRef<HTMLDivElement | null>(null)

  const [commentOpen, setCommentOpen] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [commentAnchor, setCommentAnchor] = useState<{ anchorId: string; quote: string } | null>(
    null,
  )
  const commentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection()
        if ($isRangeSelection(sel)) {
          const link = $linkAncestor(sel.anchor.getNode())
          setActive({
            bold: sel.hasFormat('bold'),
            italic: sel.hasFormat('italic'),
            underline: sel.hasFormat('underline'),
            subscript: sel.hasFormat('subscript'),
            superscript: sel.hasFormat('superscript'),
            link: !!link,
          })
          setHasRange(!sel.isCollapsed())
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

  useEffect(() => {
    if (!linkOpen) return
    const onDown = (e: PointerEvent) => {
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) setLinkOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [linkOpen])

  const applyCase = (mode: CaseTransform) => {
    setCaseOpen(false)
    editor.update(() => {
      const sel = $getSelection()
      if ($isRangeSelection(sel) && !sel.isCollapsed()) {
        sel.insertText(transformCase(sel.getTextContent(), mode))
      }
    })
  }

  // Open the link popover, pre-filling the URL when the caret is inside a link
  // (edit) versus wrapping the current selection (insert).
  const openLinkPopover = () => {
    editor.getEditorState().read(() => {
      const sel = $getSelection()
      const link = $isRangeSelection(sel) ? $linkAncestor(sel.anchor.getNode()) : null
      setEditingLink(!!link)
      setLinkUrl(link ? link.getURL() : '')
    })
    setLinkOpen(true)
  }

  const applyLink = () => {
    const url = linkUrl.trim()
    if (!url) return
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      const existing = $linkAncestor(sel.anchor.getNode())
      if (existing) {
        existing.setURL(url)
        return
      }
      const text = sel.getTextContent()
      const link = $createLinkNode(url)
      link.append($createTextNode(text || url))
      sel.insertNodes([link])
    })
    setLinkOpen(false)
  }

  const removeLink = () => {
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      const link = $linkAncestor(sel.anchor.getNode())
      if (!link) return
      // Unwrap: move the link's children out before it, then drop the link.
      for (const child of link.getChildren()) link.insertBefore(child)
      link.remove()
    })
    setLinkOpen(false)
  }

  // Comment on the current selection: wrap it in an anchor highlight now (so the
  // range is captured even if focus moves), then collect the comment body.
  const openCommentPopover = () => {
    if (!segmentId) return
    const anchorId = crypto.randomUUID()
    // Wrap and open inside the update so the pending DOM selection (e.g. a fresh
    // Ctrl+A) is reconciled first; setState here just schedules a React update.
    editor.update(() => {
      const quote = $wrapSelectionAsComment(anchorId)
      if (quote == null) return
      setCommentAnchor({ anchorId, quote })
      setCommentBody('')
      setCommentOpen(true)
    })
  }

  const submitComment = async () => {
    const body = commentBody.trim()
    if (!body || !segmentId || !commentAnchor) return
    await addRootComment(segmentId, body, commentAuthor, commentAnchor)
    setCommentOpen(false)
    setCommentAnchor(null)
    setCommentBody('')
  }

  const cancelComment = () => {
    // Drop the just-created anchor highlight from the live editor.
    if (commentAnchor) {
      const anchorId = commentAnchor.anchorId
      editor.update(() => {
        $removeCommentMarkByAnchor(anchorId)
      })
    }
    setCommentOpen(false)
    setCommentAnchor(null)
    setCommentBody('')
  }

  useEffect(() => {
    if (!commentOpen) return
    const onDown = (e: PointerEvent) => {
      if (commentRef.current && !commentRef.current.contains(e.target as Node)) cancelComment()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentOpen])

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

      <div className="relative" ref={linkRef}>
        <button
          type="button"
          aria-label="Link"
          aria-pressed={!!active.link}
          aria-haspopup="dialog"
          aria-expanded={linkOpen}
          title="Insert / edit link"
          data-testid="format-link"
          onClick={openLinkPopover}
          className="inline-flex items-center justify-center w-7 h-7 rounded transition-colors hover:bg-[var(--color-fill)]"
          style={{
            color: active.link ? 'var(--color-accent)' : 'var(--color-muted)',
            background: active.link ? 'var(--color-accent-fill)' : 'transparent',
          }}
        >
          <LinkIcon size={14} />
        </button>
        {linkOpen && (
          <div
            role="dialog"
            aria-label="Link URL"
            data-testid="format-link-popover"
            className="absolute left-0 z-30 mt-1 flex w-64 flex-col gap-2 rounded-md border p-2 shadow-md"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <input
              type="url"
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                } else if (e.key === 'Escape') {
                  setLinkOpen(false)
                }
              }}
              placeholder="https://example.com"
              data-testid="format-link-input"
              className="w-full rounded border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            />
            <div className="flex items-center justify-between gap-2">
              {editingLink ? (
                <button
                  type="button"
                  onClick={removeLink}
                  data-testid="format-link-remove"
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-fill)]"
                  style={{ color: 'var(--color-error)' }}
                >
                  Remove
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={applyLink}
                disabled={!linkUrl.trim()}
                data-testid="format-link-apply"
                className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
              >
                {editingLink ? 'Update' : 'Add link'}
              </button>
            </div>
          </div>
        )}
      </div>

      {segmentId && (
        <div className="relative" ref={commentRef}>
          <button
            type="button"
            aria-label="Comment on selection"
            aria-haspopup="dialog"
            aria-expanded={commentOpen}
            disabled={!hasRange && !commentOpen}
            title="Comment on selection"
            data-testid="format-comment"
            onClick={openCommentPopover}
            className="inline-flex items-center justify-center w-7 h-7 rounded transition-colors hover:bg-[var(--color-fill)] disabled:opacity-40"
            style={{ color: 'var(--color-muted)' }}
          >
            <MessageSquarePlus size={14} />
          </button>
          {commentOpen && (
            <div
              role="dialog"
              aria-label="New comment"
              data-testid="format-comment-popover"
              className="absolute left-0 z-30 mt-1 flex w-64 flex-col gap-2 rounded-md border p-2 shadow-md"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              {commentAnchor?.quote && (
                <p className="text-xs italic line-clamp-2" style={{ color: 'var(--color-muted)' }}>
                  “{commentAnchor.quote}”
                </p>
              )}
              <textarea
                autoFocus
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    void submitComment()
                  } else if (e.key === 'Escape') {
                    cancelComment()
                  }
                }}
                rows={3}
                placeholder="Add a comment…"
                data-testid="format-comment-input"
                className="w-full resize-none rounded border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelComment}
                  data-testid="format-comment-cancel"
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-fill)]"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitComment()}
                  disabled={!commentBody.trim()}
                  data-testid="format-comment-apply"
                  className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
                >
                  Comment
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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

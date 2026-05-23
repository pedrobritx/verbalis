import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, PanelRight, PanelRightClose } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { tmRepo } from '@/storage/repositories/tmRepo'
import { SegmentRow } from './SegmentRow'
import { useProjectSegments } from './useProjectSegments'
import { SidebarPanel } from './SidebarPanel'
import { useSidebarPanelStore } from './useSidebarPanelStore'

export default function EditorPage() {
  const { id } = useParams() as { id?: string }
  const project = useLiveQuery(() => (id ? projectRepo.getById(id) : undefined), [id])
  const segments = useProjectSegments(id)
  const [focusIndex, setFocusIndex] = useState(0)
  const textareaRefs = useRef<Array<HTMLTextAreaElement | null>>([])
  const panelOpen = useSidebarPanelStore((s) => s.open)
  const togglePanel = useSidebarPanelStore((s) => s.toggle)

  const registerTextarea = useCallback((index: number, el: HTMLTextAreaElement | null) => {
    textareaRefs.current[index] = el
  }, [])

  useEffect(() => {
    const el = textareaRefs.current[focusIndex]
    if (el && document.activeElement !== el) el.focus()
  }, [focusIndex])

  if (!id) return null

  if (project === undefined || segments === undefined) {
    return (
      <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
        Loading…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
        Project not found.{' '}
        <Link to="/" className="underline">
          Back to projects
        </Link>
      </div>
    )
  }

  const moveFocus = (from: number, direction: -1 | 1) => {
    const next = from + direction
    if (next >= 0 && next < segments.length) setFocusIndex(next)
  }

  const confirm = async (i: number) => {
    const seg = segments[i]
    if (!seg) return
    await segmentRepo.update(seg.id, { status: 'translated' })
    const fresh = await segmentRepo.getById(seg.id)
    if (fresh?.target && fresh.target.trim()) {
      try {
        await tmRepo.upsert({
          source: fresh.source,
          target: fresh.target,
          sourceLang: project.sourceLang,
          targetLang: project.targetLang,
          projectId: project.id,
        })
      } catch (err) {
        console.warn('TM upsert failed', err)
      }
    }
    if (i + 1 < segments.length) setFocusIndex(i + 1)
  }

  const handleApplyTM = async (target: string) => {
    const seg = segments[focusIndex]
    if (!seg) return
    const nextStatus = seg.status === 'untranslated' ? 'draft' : seg.status
    await segmentRepo.update(seg.id, { target, status: nextStatus })
    const el = textareaRefs.current[focusIndex]
    if (el) el.focus()
  }

  const handleInsertGlossary = async (text: string) => {
    const seg = segments[focusIndex]
    const el = textareaRefs.current[focusIndex]
    if (!seg || !el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = el.value.slice(0, start)
    const after = el.value.slice(end)
    const newValue = before + text + after
    const trimmed = newValue.trim()
    const nextStatus =
      seg.status === 'untranslated' && trimmed.length > 0 ? 'draft' : seg.status
    await segmentRepo.update(seg.id, { target: newValue, status: nextStatus })
    requestAnimationFrame(() => {
      const target = textareaRefs.current[focusIndex]
      if (!target) return
      target.focus()
      const caret = start + text.length
      try {
        target.setSelectionRange(caret, caret)
      } catch {
        // selection range not supported on this element type — ignore.
      }
    })
  }

  const focusedSource = segments[focusIndex]?.source

  return (
    <div
      className={
        panelOpen
          ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 max-w-6xl mx-auto'
          : 'flex flex-col gap-4 max-w-5xl mx-auto'
      }
    >
      <div className="flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="inline-flex items-center text-sm"
              style={{ color: 'var(--color-muted)' }}
            >
              <ChevronLeft size={16} />
              Projects
            </Link>
            <h1
              className="text-xl font-semibold truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {project.name}
            </h1>
            <Badge variant="outline" style={{ color: 'var(--color-muted)' }}>
              {project.sourceLang} → {project.targetLang}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {segments.length} segments
            </span>
            <button
              onClick={togglePanel}
              aria-label={panelOpen ? 'Hide sidebar' : 'Show sidebar'}
              data-testid="sidebar-toggle"
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--color-muted)' }}
            >
              {panelOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
            </button>
          </div>
        </div>

        {segments.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-10 text-center"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          >
            <p className="text-sm">No segments in this project.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" data-testid="segment-list">
            {segments.map((seg, i) => (
              <SegmentRow
                key={seg.id}
                segment={seg}
                isFocused={i === focusIndex}
                onConfirm={() => confirm(i)}
                onMoveFocus={(dir) => moveFocus(i, dir)}
                onFocus={() => setFocusIndex(i)}
                registerTextarea={(el) => registerTextarea(i, el)}
              />
            ))}
          </div>
        )}
      </div>

      {panelOpen && (
        <SidebarPanel
          focusedSource={focusedSource}
          projectId={project.id}
          sourceLang={project.sourceLang}
          targetLang={project.targetLang}
          onApplyTM={handleApplyTM}
          onInsertGlossary={handleInsertGlossary}
        />
      )}
    </div>
  )
}

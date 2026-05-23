import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { SegmentRow } from './SegmentRow'
import { useProjectSegments } from './useProjectSegments'

export default function EditorPage() {
  const { id } = useParams() as { id?: string }
  const project = useLiveQuery(() => (id ? projectRepo.getById(id) : undefined), [id])
  const segments = useProjectSegments(id)
  const [focusIndex, setFocusIndex] = useState(0)
  const textareaRefs = useRef<Array<HTMLTextAreaElement | null>>([])

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
    if (i + 1 < segments.length) setFocusIndex(i + 1)
  }

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
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
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {segments.length} segments
        </span>
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
  )
}

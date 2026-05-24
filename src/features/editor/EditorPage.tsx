import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Eye, PanelRight, PanelRightClose } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { tmRepo } from '@/storage/repositories/tmRepo'
import { SegmentRow } from './SegmentRow'
import { useProjectSegments } from './useProjectSegments'
import { SidebarPanel } from './SidebarPanel'
import { MobileSidebarSheet } from './MobileSidebarSheet'
import { StatusFilterBar } from './StatusFilterBar'
import { useSidebarPanelStore } from './useSidebarPanelStore'
import { useEditorModeStore } from './useEditorModeStore'
import { useEditorActionsStore } from './useEditorActionsStore'
import { translateWith, resolveDefaultProvider, MTError } from '@/core/mt'
import { getMTSettings } from '@/storage/repositories/settingsRepo'
import type { Segment, SegmentStatus, MTProviderId } from '@/core/types'

export default function EditorPage() {
  const { id } = useParams() as { id?: string }
  const project = useLiveQuery(() => (id ? projectRepo.getById(id) : undefined), [id])
  const segments = useProjectSegments(id)
  const [focusIndex, setFocusIndex] = useState(0)
  const textareaRefs = useRef<Array<HTMLTextAreaElement | null>>([])
  const panelOpen = useSidebarPanelStore((s) => s.open)
  const togglePanel = useSidebarPanelStore((s) => s.toggle)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const handleTogglePanel = useCallback(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (isMobile) {
      setMobileSheetOpen((v) => !v)
    } else {
      togglePanel()
    }
  }, [togglePanel])
  const reviewMode = useEditorModeStore((s) => s.reviewMode)
  const toggleReviewMode = useEditorModeStore((s) => s.toggleReviewMode)
  const statusFilter = useEditorModeStore((s) => s.statusFilter)
  const setActions = useEditorActionsStore((s) => s.setActions)

  const registerTextarea = useCallback((index: number, el: HTMLTextAreaElement | null) => {
    textareaRefs.current[index] = el
  }, [])

  useEffect(() => {
    const el = textareaRefs.current[focusIndex]
    if (el && document.activeElement !== el) el.focus()
  }, [focusIndex])

  const visibleSegments = useMemo(() => {
    if (!segments) return [] as Array<{ seg: Segment; originalIndex: number }>
    if (statusFilter === 'all') {
      return segments.map((seg, i) => ({ seg, originalIndex: i }))
    }
    return segments
      .map((seg, i) => ({ seg, originalIndex: i }))
      .filter(({ seg }) => seg.status === statusFilter)
  }, [segments, statusFilter])

  const toggleReviewed = useCallback(
    async (i: number) => {
      const seg = segments?.[i]
      if (!seg) return
      const nextStatus: SegmentStatus = seg.status === 'reviewed' ? 'translated' : 'reviewed'
      await segmentRepo.update(seg.id, { status: nextStatus })
    },
    [segments],
  )

  const translateCurrentWithMT = useCallback(
    async (providerOverride?: MTProviderId): Promise<void> => {
      const seg = segments?.[focusIndex]
      if (!seg || !project) return
      const settings = await getMTSettings()
      const providerId = providerOverride ?? resolveDefaultProvider(settings)
      if (!providerId) return
      try {
        const res = await translateWith(
          providerId,
          {
            text: seg.source,
            sourceLang: project.sourceLang,
            targetLang: project.targetLang,
          },
          settings,
        )
        const nextStatus = seg.status === 'untranslated' ? 'draft' : seg.status
        await segmentRepo.update(seg.id, { target: res.text, status: nextStatus })
      } catch (err) {
        if (err instanceof MTError) {
          console.warn(`MT (${err.providerId}/${err.code}):`, err.message)
        } else {
          console.warn('MT failed', err)
        }
      }
    },
    [segments, focusIndex, project],
  )

  useEffect(() => {
    if (!segments || segments.length === 0) {
      setActions(null)
      return
    }
    setActions({
      markCurrentReviewed: () => {
        void toggleReviewed(focusIndex)
      },
      jumpToNextWithStatus: (status) => {
        const start = focusIndex
        for (let offset = 1; offset <= segments.length; offset += 1) {
          const idx = (start + offset) % segments.length
          if (segments[idx].status === status) {
            setFocusIndex(idx)
            return
          }
        }
      },
      jumpToSegment: (oneBasedIndex) => {
        const i = oneBasedIndex - 1
        if (i >= 0 && i < segments.length) setFocusIndex(i)
      },
      translateCurrentWithMT: (providerId) => translateCurrentWithMT(providerId),
    })
    return () => setActions(null)
  }, [segments, focusIndex, toggleReviewed, translateCurrentWithMT, setActions])

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
      data-review-mode={reviewMode ? 'on' : 'off'}
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
              onClick={toggleReviewMode}
              aria-label={reviewMode ? 'Exit review mode' : 'Enter review mode'}
              aria-pressed={reviewMode}
              data-testid="review-mode-toggle"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                reviewMode ? 'font-semibold' : 'hover:opacity-80',
              )}
              style={{
                borderColor: reviewMode ? 'var(--color-accent)' : 'var(--color-border)',
                color: reviewMode ? 'var(--color-accent)' : 'var(--color-muted)',
                background: reviewMode ? 'rgba(0,194,204,0.08)' : 'transparent',
              }}
            >
              <Eye size={12} />
              Review
            </button>
            <button
              onClick={handleTogglePanel}
              aria-label={panelOpen ? 'Hide tools' : 'Show tools'}
              data-testid="sidebar-toggle"
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--color-muted)' }}
            >
              {panelOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
            </button>
          </div>
        </div>

        <StatusFilterBar projectId={project.id} />

        {segments.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-10 text-center"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          >
            <p className="text-sm">No segments in this project.</p>
          </div>
        ) : visibleSegments.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-10 text-center"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            data-testid="empty-filter"
          >
            <p className="text-sm">No segments match this filter.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" data-testid="segment-list">
            {visibleSegments.map(({ seg, originalIndex }) => (
              <SegmentRow
                key={seg.id}
                segment={seg}
                isFocused={originalIndex === focusIndex}
                onConfirm={() => confirm(originalIndex)}
                onToggleReviewed={() => toggleReviewed(originalIndex)}
                onMoveFocus={(dir) => moveFocus(originalIndex, dir)}
                onFocus={() => setFocusIndex(originalIndex)}
                registerTextarea={(el) => registerTextarea(originalIndex, el)}
              />
            ))}
          </div>
        )}
      </div>

      {panelOpen && (
        <div className="hidden md:block">
          <SidebarPanel
            focusedSource={focusedSource}
            projectId={project.id}
            sourceLang={project.sourceLang}
            targetLang={project.targetLang}
            onApplyTM={handleApplyTM}
            onInsertGlossary={handleInsertGlossary}
            onApplyMT={handleApplyTM}
          />
        </div>
      )}

      <div className="md:hidden">
        <MobileSidebarSheet
          open={mobileSheetOpen}
          onOpenChange={setMobileSheetOpen}
          focusedSource={focusedSource}
          projectId={project.id}
          sourceLang={project.sourceLang}
          targetLang={project.targetLang}
          onApplyTM={handleApplyTM}
          onInsertGlossary={handleInsertGlossary}
          onApplyMT={handleApplyTM}
        />
      </div>
    </div>
  )
}

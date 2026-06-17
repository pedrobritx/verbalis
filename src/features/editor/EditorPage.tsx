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
import { EditorToolbar } from './tools/EditorToolbar'
import { FindReplaceDialog } from './findReplace/FindReplaceDialog'
import { useFindReplaceStore } from './findReplace/useFindReplaceStore'
import { AnalysisDialog } from './analysis/AnalysisDialog'
import { useAnalysisStore } from './analysis/useAnalysisStore'
import { AddTermDialog } from './glossary/AddTermDialog'
import { ConcordanceDialog } from './concordance/ConcordanceDialog'
import { translateWith, resolveDefaultProvider, MTError } from '@/core/mt'
import { getMTSettings, getEditorSettings } from '@/storage/repositories/settingsRepo'
import { normalize } from '@/core/tm/similarity'
import { pretranslate } from '@/core/tm/leverage'
import { convertNumerals, isNumberOnly, numeralScriptForLang } from '@/core/numbers'
import { XliffExportButton } from '@/features/bilingual/XliffExportButton'
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
  const setSidebarTab = useSidebarPanelStore((s) => s.setTab)
  const setPanelOpen = useSidebarPanelStore((s) => s.setOpen)
  const openFindReplace = useFindReplaceStore((s) => s.setOpen)
  const openAnalysis = useAnalysisStore((s) => s.setOpen)
  const [toolMsg, setToolMsg] = useState<string | null>(null)

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

  const runPretranslate = useCallback(async (): Promise<void> => {
    if (!project || !segments) return
    const prefs = await getEditorSettings()
    const memory = await tmRepo.byLangPair(project.sourceLang, project.targetLang)
    const hits = pretranslate(segments, memory, { minScore: prefs.pretranslateThreshold })
    await Promise.all(
      hits.map((h) =>
        segmentRepo.update(h.segmentId, {
          target: h.target,
          status: h.isExact ? 'translated' : 'draft',
        }),
      ),
    )
    setToolMsg(
      hits.length
        ? `Pre-translated ${hits.length} segment${hits.length === 1 ? '' : 's'} from TM.`
        : 'No TM matches above threshold.',
    )
  }, [project, segments])

  const populateNumbers = useCallback(async (): Promise<void> => {
    if (!project || !segments) return
    const script = numeralScriptForLang(project.targetLang)
    const targets = segments.filter((s) => s.status === 'untranslated' && isNumberOnly(s.source))
    await Promise.all(
      targets.map((s) =>
        segmentRepo.update(s.id, {
          target: convertNumerals(s.source, script),
          status: 'translated',
        }),
      ),
    )
    setToolMsg(
      targets.length
        ? `Populated ${targets.length} number-only segment${targets.length === 1 ? '' : 's'}.`
        : 'No number-only segments to populate.',
    )
  }, [project, segments])

  const runQA = useCallback(() => {
    setPanelOpen(true)
    setSidebarTab('qa')
  }, [setPanelOpen, setSidebarTab])

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
      runPretranslate,
      populateNumbers,
    })
    return () => setActions(null)
  }, [
    segments,
    focusIndex,
    toggleReviewed,
    translateCurrentWithMT,
    runPretranslate,
    populateNumbers,
    setActions,
  ])

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
      // Auto-propagate: fill identical untranslated segments with this target as
      // drafts, so repeated content is translated once (memoQ-style). Drafts,
      // not confirmed, so the translator still reviews each one.
      const prefs = await getEditorSettings()
      if (prefs.autoPropagate) {
        const key = normalize(fresh.source)
        const repeats = segments.filter(
          (s) => s.id !== fresh.id && s.status === 'untranslated' && normalize(s.source) === key,
        )
        if (repeats.length > 0) {
          await Promise.all(
            repeats.map((s) => segmentRepo.update(s.id, { target: fresh.target, status: 'draft' })),
          )
          setToolMsg(`Filled ${repeats.length} repeated segment${repeats.length === 1 ? '' : 's'}.`)
        }
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
        <div className="flex flex-col gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-footnote self-start"
            style={{ color: 'var(--color-muted)' }}
          >
            <ChevronLeft size={16} />
            Projects
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <h1
                className="text-title-2 font-semibold truncate"
                style={{ color: 'var(--color-text)' }}
              >
                {project.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" style={{ color: 'var(--color-muted)' }}>
                  {project.sourceLang} → {project.targetLang}
                </Badge>
                <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
                  {segments.length} segments
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {project.bilingualMeta?.format === 'xliff12' && (
                <XliffExportButton project={project} segments={segments} />
              )}
              <button
                onClick={toggleReviewMode}
                aria-label={reviewMode ? 'Exit review mode' : 'Enter review mode'}
                aria-pressed={reviewMode}
                data-testid="review-mode-toggle"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border h-9 px-3 text-footnote transition-colors',
                  reviewMode ? 'font-semibold' : 'hover:opacity-80',
                )}
                style={{
                  borderColor: reviewMode ? 'var(--color-accent)' : 'var(--color-border)',
                  color: reviewMode ? 'var(--color-accent)' : 'var(--color-muted)',
                  background: reviewMode ? 'var(--color-accent-fill)' : 'transparent',
                }}
              >
                <Eye size={14} />
                Review
              </button>
              <button
                onClick={handleTogglePanel}
                aria-label={panelOpen ? 'Hide tools' : 'Show tools'}
                data-testid="sidebar-toggle"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[var(--color-fill)]"
                style={{ color: 'var(--color-muted)' }}
              >
                {panelOpen ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
              </button>
            </div>
          </div>
        </div>

        <EditorToolbar
          onPretranslate={() => void runPretranslate()}
          onPopulateNumbers={() => void populateNumbers()}
          onFindReplace={() => openFindReplace(true)}
          onRunQA={runQA}
          onAnalysis={() => openAnalysis(true)}
        />

        {toolMsg && (
          <div
            className="rounded-md border px-3 py-2 text-footnote"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-fill)',
              color: 'var(--color-muted)',
            }}
            data-testid="tool-message"
            role="status"
          >
            {toolMsg}
          </div>
        )}

        <StatusFilterBar projectId={project.id} />

        {segments.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-10 text-center"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          >
            <p className="text-callout">No segments in this project.</p>
          </div>
        ) : visibleSegments.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-10 text-center"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            data-testid="empty-filter"
          >
            <p className="text-callout">No segments match this filter.</p>
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

      <FindReplaceDialog projectId={project.id} />
      <AnalysisDialog project={project} />
      <AddTermDialog projectId={project.id} targetLang={project.targetLang} />
      <ConcordanceDialog project={project} />
    </div>
  )
}

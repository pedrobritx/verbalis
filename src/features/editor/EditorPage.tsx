import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, PanelRight, PanelRightClose, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { segmentRepo, tallyStatus } from '@/storage/repositories/segmentRepo'
import { tmRepo } from '@/storage/repositories/tmRepo'
import { SegmentRow } from './SegmentRow'
import { useProjectSegments } from './useProjectSegments'
import { SidebarPanel } from './SidebarPanel'
import { MobileSidebarSheet } from './MobileSidebarSheet'
import { StatusFilterBar } from './StatusFilterBar'
import { StageSwitcher } from './StageSwitcher'
import { useSidebarPanelStore } from './useSidebarPanelStore'
import { useEditorModeStore } from './useEditorModeStore'
import { useEditorActionsStore } from './useEditorActionsStore'
import { EditorToolbar } from './tools/EditorToolbar'
import { PeersPresenceChip } from './peers/PeersPresenceChip'
import { FindReplaceDialog } from './findReplace/FindReplaceDialog'
import { useFindReplaceStore } from './findReplace/useFindReplaceStore'
import { AnalysisDialog } from './analysis/AnalysisDialog'
import { useAnalysisStore } from './analysis/useAnalysisStore'
import { AddTermDialog } from './glossary/AddTermDialog'
import { GlossaryEditController } from './glossary/GlossaryEditController'
import { ConcordanceDialog } from './concordance/ConcordanceDialog'
import { useProjectDialogsStore } from '@/features/projects/useProjectDialogsStore'
import { translateWith, resolveDefaultProvider, MTError } from '@/core/mt'
import {
  getMTSettings,
  getEditorSettings,
  getProfileSettings,
  getSpellSettings,
} from '@/storage/repositories/settingsRepo'
import { EditorTips } from './EditorTips'
import { SplitSegmentDialog } from './segments/SplitSegmentDialog'
import { SegmentHistoryDialog } from './history/SegmentHistoryDialog'
import { useProjectCrdt } from './useProjectCrdt'
import { useProjectSync } from './peers/useProjectSync'
import { canJoin } from '@/core/segments/operations'
import { buildSearchUrl } from '@/core/websearch/providers'
import { useEditorSettings } from './useEditorSettings'
import type { SegmentEditorHandle } from './SegmentEditorHandle'
import { normalize } from '@/core/tm/similarity'
import { pretranslate } from '@/core/tm/leverage'
import { convertNumerals, isNumberOnly, numeralScriptForLang } from '@/core/numbers'
import { XliffExportButton } from '@/features/bilingual/XliffExportButton'
import type { Segment, SegmentStatus, MTProviderId } from '@/core/types'

export default function EditorPage() {
  const { id } = useParams() as { id?: string }
  const project = useLiveQuery(() => (id ? projectRepo.getById(id) : undefined), [id])
  const segments = useProjectSegments(id)
  // Loads the project's Yjs doc (sync-ready merge layer + version history) for
  // the lifetime of the editor and drives the throttled auto-snapshot net.
  useProjectCrdt(id)
  // Live LAN collaboration (Foundation F3): runs a peer sync session whenever the
  // project is shared, and lets presence follow the focused segment.
  const { setActiveSegment } = useProjectSync(id)
  const profile = useLiveQuery(() => getProfileSettings(), [])
  const commentAuthor = profile?.displayName.trim() || undefined
  const [focusIndex, setFocusIndex] = useState(0)
  const editorHandles = useRef<Array<SegmentEditorHandle | null>>([])
  const { richEditing, autocorrect } = useEditorSettings()
  const spellEnabled = useLiveQuery(() => getSpellSettings().then((s) => s.enabled), []) ?? false
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
  const stage = useEditorModeStore((s) => s.stage)
  const statusFilter = useEditorModeStore((s) => s.statusFilter)
  const setActions = useEditorActionsStore((s) => s.setActions)
  const setSidebarTab = useSidebarPanelStore((s) => s.setTab)
  const setPanelOpen = useSidebarPanelStore((s) => s.setOpen)
  const openFindReplace = useFindReplaceStore((s) => s.setOpen)
  const openAnalysis = useAnalysisStore((s) => s.setOpen)
  const openProjectDialog = useProjectDialogsStore((s) => s.open)
  const [toolMsg, setToolMsg] = useState<string | null>(null)

  const registerHandle = useCallback((index: number, handle: SegmentEditorHandle | null) => {
    editorHandles.current[index] = handle
  }, [])

  useEffect(() => {
    editorHandles.current[focusIndex]?.focus()
  }, [focusIndex])

  // Broadcast which segment the local user is on, so peers' presence follows.
  // This must run unconditionally — above the early returns below — so the hook
  // order stays stable across the loading → loaded transition (a hook placed
  // after those returns triggers React error #310 once data resolves).
  const activeSegmentId = segments?.[focusIndex]?.id
  useEffect(() => {
    setActiveSegment(activeSegmentId)
  }, [activeSegmentId, setActiveSegment])

  // Derive status counts from the segments already in memory so the filter bar
  // doesn't re-scan the same rows from the database.
  const statusCounts = useMemo(
    () => (segments ? tallyStatus(segments) : undefined),
    [segments],
  )

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
    const hits = pretranslate(
      segments.filter((s) => !s.locked),
      memory,
      { minScore: prefs.pretranslateThreshold },
    )
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
    const targets = segments.filter(
      (s) => s.status === 'untranslated' && !s.locked && isNumberOnly(s.source),
    )
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

  // Stage drives the sidebar: each stage owns its own (customisable) panel layout,
  // so on a stage *change* we just reveal the panel — the stacked tools for the new
  // stage render themselves. On mount we leave the panel's open/closed choice alone.
  // The smart status-filter default lives in the store's setStage.
  const prevStageRef = useRef(stage)
  useEffect(() => {
    if (prevStageRef.current === stage) return
    prevStageRef.current = stage
    setPanelOpen(true)
  }, [stage, setPanelOpen])

  // Ctrl/⌘+Shift+L reveals the Lookup panel in the current stage (adding it if the
  // translator removed it) so a selected word can be looked up without hunting for
  // the tool. The panel already mirrors the live selection once visible.
  const showPanel = useSidebarPanelStore((s) => s.showPanel)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        showPanel(useEditorModeStore.getState().stage, 'lookup')
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
        if (isMobile) setMobileSheetOpen(true)
        else setPanelOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showPanel, setPanelOpen])

  // The header presence chip opens the Peers panel into whichever container is
  // live for the viewport (desktop sidebar vs. mobile sheet).
  const openPeers = useCallback(() => {
    setSidebarTab('peers')
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (isMobile) setMobileSheetOpen(true)
    else setPanelOpen(true)
  }, [setSidebarTab, setPanelOpen])

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
      webSearchCurrent: (provider) => {
        if (!project) return
        const seg = segments[focusIndex]
        const q = seg?.source?.trim()
        if (!q) return
        const url = buildSearchUrl(provider, {
          q,
          src: project.sourceLang,
          tgt: project.targetLang,
        })
        window.open(url, '_blank', 'noopener,noreferrer')
      },
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
    project,
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

  const isBilingual = project.bilingualMeta?.format === 'xliff12'

  const moveFocus = (from: number, direction: -1 | 1) => {
    const next = from + direction
    if (next >= 0 && next < segments.length) setFocusIndex(next)
  }

  const handleJoin = async (i: number) => {
    const seg = segments[i]
    if (!seg) return
    await segmentRepo.joinWithNext(project.id, seg.id)
  }

  const confirm = async (i: number) => {
    const seg = segments[i]
    if (!seg || seg.locked) return
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
          (s) =>
            s.id !== fresh.id &&
            s.status === 'untranslated' &&
            !s.locked &&
            normalize(s.source) === key,
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
    if (!seg || seg.locked) return
    const nextStatus = seg.status === 'untranslated' ? 'draft' : seg.status
    // Clear any rich state so the (rich) editor rebuilds from this plain text.
    await segmentRepo.update(seg.id, { target, targetRich: undefined, status: nextStatus })
    editorHandles.current[focusIndex]?.focus()
  }

  const handleInsertGlossary = (text: string) => {
    const seg = segments[focusIndex]
    if (!seg || seg.locked) return
    // The per-segment editor (plain or rich) owns caret insertion and autosave.
    editorHandles.current[focusIndex]?.insertText(text)
  }

  const focusedSource = segments[focusIndex]?.source
  const focusedTarget = segments[focusIndex]?.target
  const focusedId = segments[focusIndex]?.id

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
              <PeersPresenceChip onOpen={openPeers} />
              <button
                onClick={() => openProjectDialog('edit', project.id)}
                aria-label="Edit project"
                title="Edit project"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[var(--color-fill)]"
                style={{ color: 'var(--color-muted)' }}
                data-testid="editor-edit-project"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => openProjectDialog('delete', project.id)}
                aria-label="Delete project"
                title="Delete project"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[var(--color-fill)]"
                style={{ color: 'var(--color-error)' }}
                data-testid="editor-delete-project"
              >
                <Trash2 size={16} />
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

        <div className="flex flex-col gap-2">
          <StageSwitcher />
          <EditorToolbar
            stage={stage}
            onPretranslate={() => void runPretranslate()}
            onPopulateNumbers={() => void populateNumbers()}
            onFindReplace={() => openFindReplace(true)}
            onRunQA={runQA}
            onAnalysis={() => openAnalysis(true)}
          />
        </div>

        <EditorTips />

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

        <StatusFilterBar counts={statusCounts} />

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
                reviewMode={reviewMode}
                isBilingual={isBilingual}
                canJoinNext={
                  !isBilingual &&
                  originalIndex + 1 < segments.length &&
                  canJoin(seg, segments[originalIndex + 1])
                }
                richEditing={richEditing}
                autocorrect={autocorrect}
                targetLang={project.targetLang}
                spellEnabled={spellEnabled}
                commentAuthor={commentAuthor}
                onConfirm={() => confirm(originalIndex)}
                onToggleReviewed={() => toggleReviewed(originalIndex)}
                onJoin={() => handleJoin(originalIndex)}
                onMoveFocus={(dir) => moveFocus(originalIndex, dir)}
                onFocus={() => setFocusIndex(originalIndex)}
                registerHandle={(h) => registerHandle(originalIndex, h)}
              />
            ))}
          </div>
        )}
      </div>

      {panelOpen && (
        <div className="hidden md:block">
          <SidebarPanel
            focusedSource={focusedSource}
            focusedTarget={focusedTarget}
            focusedSegmentId={focusedId}
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
          focusedTarget={focusedTarget}
          focusedSegmentId={focusedId}
          projectId={project.id}
          sourceLang={project.sourceLang}
          targetLang={project.targetLang}
          onApplyTM={handleApplyTM}
          onInsertGlossary={handleInsertGlossary}
          onApplyMT={handleApplyTM}
        />
      </div>

      <FindReplaceDialog projectId={project.id} />
      <SplitSegmentDialog projectId={project.id} />
      <SegmentHistoryDialog />
      <AnalysisDialog project={project} />
      <AddTermDialog projectId={project.id} targetLang={project.targetLang} />
      <GlossaryEditController />
      <ConcordanceDialog project={project} />
    </div>
  )
}

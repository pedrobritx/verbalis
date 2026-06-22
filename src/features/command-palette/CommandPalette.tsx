import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, matchPath } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FolderOpen,
  Database,
  BookA,
  Settings,
  Sun,
  Moon,
  FilePlus,
  PanelRight,
  Eye,
  CheckCircle2,
  Filter,
  ArrowRight,
  FileText,
  Wand2,
  Keyboard,
  Sparkles,
  Hash,
  Replace,
  ShieldCheck,
  BarChart3,
  BookA as BookAddIcon,
  Pencil,
  Copy,
  Trash2,
  Globe,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useTheme } from '@/app/providers'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { useCommandPaletteStore } from './useCommandPaletteStore'
import { useSidebarPanelStore } from '@/features/editor/useSidebarPanelStore'
import { useEditorModeStore, type StatusFilter } from '@/features/editor/useEditorModeStore'
import { useEditorActionsStore } from '@/features/editor/useEditorActionsStore'
import { useFindReplaceStore } from '@/features/editor/findReplace/useFindReplaceStore'
import { useAnalysisStore } from '@/features/editor/analysis/useAnalysisStore'
import { useAddTermStore } from '@/features/editor/glossary/useAddTermStore'
import { useConcordanceStore } from '@/features/editor/concordance/useConcordanceStore'
import { useProjectDialogsStore } from '@/features/projects/useProjectDialogsStore'
import { useImportDialogStore } from '@/features/import/useImportDialogStore'
import { useShortcutsStore } from '@/features/shortcuts/useShortcutsStore'
import { getWebSearchSettings } from '@/storage/repositories/settingsRepo'

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'untranslated', label: 'Untranslated' },
  { id: 'draft', label: 'Draft' },
  { id: 'translated', label: 'Translated' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'locked', label: 'Locked' },
]

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open)
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()
  const togglePanel = useSidebarPanelStore((s) => s.toggle)
  const setSidebarTab = useSidebarPanelStore((s) => s.setTab)
  const setSidebarOpen = useSidebarPanelStore((s) => s.setOpen)
  const openFindReplace = useFindReplaceStore((s) => s.setOpen)
  const openAnalysis = useAnalysisStore((s) => s.setOpen)
  const openAddTerm = useAddTermStore((s) => s.openWith)
  const openConcordance = useConcordanceStore((s) => s.openWith)
  const reviewMode = useEditorModeStore((s) => s.reviewMode)
  const toggleReviewMode = useEditorModeStore((s) => s.toggleReviewMode)
  const setStatusFilter = useEditorModeStore((s) => s.setStatusFilter)
  const editorActions = useEditorActionsStore((s) => s.actions)
  const openImport = useImportDialogStore((s) => s.setOpen)
  const openShortcuts = useShortcutsStore((s) => s.setOpen)
  const openProjectDialog = useProjectDialogsStore((s) => s.open)
  const projects = useLiveQuery(() => projectRepo.getAll(), [])
  const webSearch = useLiveQuery(() => getWebSearchSettings(), [])
  const webSearchProviders = useMemo(
    () => (webSearch?.providers ?? []).filter((p) => p.enabled),
    [webSearch],
  )

  const projectMatch = matchPath('/project/:id', pathname)
  const currentProjectId = projectMatch?.params.id
  const inEditor = Boolean(projectMatch)

  const run = useCallback(
    (fn: () => void) => {
      fn()
      setOpen(false)
    },
    [setOpen],
  )

  const editorItems = useMemo(() => {
    if (!inEditor) return null
    return (
      <>
        <CommandGroup heading="Editor">
          <CommandItem
            onSelect={() => run(() => togglePanel())}
            data-testid="cmd-toggle-sidebar"
          >
            <PanelRight />
            <span>Toggle sidebar panel</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => setSidebarTab('tm'))}>
            <Database />
            <span>Switch sidebar to TM</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => setSidebarTab('glossary'))}>
            <BookA />
            <span>Switch sidebar to Glossary</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => setSidebarTab('mt'))}
            data-testid="cmd-sidebar-mt"
          >
            <Wand2 />
            <span>Switch sidebar to Machine translation</span>
          </CommandItem>
          <CommandItem
            disabled={!editorActions}
            onSelect={() => run(() => void editorActions?.translateCurrentWithMT())}
            data-testid="cmd-translate-mt"
          >
            <Wand2 />
            <span>Translate current segment with MT</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => toggleReviewMode())}
            data-testid="cmd-toggle-review-mode"
          >
            <Eye />
            <span>{reviewMode ? 'Exit review mode' : 'Enter review mode'}</span>
            <CommandShortcut>⌃⇧R</CommandShortcut>
          </CommandItem>
          <CommandItem
            disabled={!editorActions}
            onSelect={() => run(() => editorActions?.markCurrentReviewed())}
            data-testid="cmd-mark-reviewed"
          >
            <CheckCircle2 />
            <span>Mark current segment reviewed</span>
            <CommandShortcut>⌃⇧↵</CommandShortcut>
          </CommandItem>
          <CommandItem
            disabled={!editorActions}
            onSelect={() => run(() => editorActions?.jumpToNextWithStatus('untranslated'))}
          >
            <ArrowRight />
            <span>Jump to next untranslated</span>
          </CommandItem>
          <CommandItem
            disabled={!editorActions}
            onSelect={() => run(() => editorActions?.jumpToNextWithStatus('draft'))}
          >
            <ArrowRight />
            <span>Jump to next draft</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Tools">
          <CommandItem
            disabled={!editorActions}
            onSelect={() => run(() => void editorActions?.runPretranslate())}
            data-testid="cmd-pretranslate"
          >
            <Sparkles />
            <span>Pre-translate from TM</span>
          </CommandItem>
          <CommandItem
            disabled={!editorActions}
            onSelect={() => run(() => void editorActions?.populateNumbers())}
            data-testid="cmd-populate-numbers"
          >
            <Hash />
            <span>Populate number-only segments</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => openFindReplace(true))}
            data-testid="cmd-find-replace"
          >
            <Replace />
            <span>Find &amp; replace…</span>
            <CommandShortcut>⌃H</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                setSidebarOpen(true)
                setSidebarTab('qa')
              })
            }
            data-testid="cmd-run-qa"
          >
            <ShieldCheck />
            <span>Run quality assurance</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => openAnalysis(true))} data-testid="cmd-analysis">
            <BarChart3 />
            <span>Show analysis</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => openAddTerm(''))}
            data-testid="cmd-add-term"
          >
            <BookAddIcon />
            <span>Add glossary term…</span>
            <CommandShortcut>⌃E</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => openConcordance(''))}
            data-testid="cmd-concordance"
          >
            <Database />
            <span>Concordance search…</span>
            <CommandShortcut>⌃⇧K</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        {webSearchProviders.length > 0 && (
          <CommandGroup heading="Web search (source term)">
            {webSearchProviders.map((p) => (
              <CommandItem
                key={p.id}
                value={`web search ${p.name}`}
                disabled={!editorActions}
                onSelect={() => run(() => editorActions?.webSearchCurrent(p))}
                data-testid={`cmd-websearch-${p.id}`}
              >
                <Globe />
                <span>Search “{p.name}” for current source</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Project">
          <CommandItem
            disabled={!currentProjectId}
            onSelect={() => run(() => currentProjectId && openProjectDialog('edit', currentProjectId))}
            data-testid="cmd-edit-project"
          >
            <Pencil />
            <span>Edit project (rename / languages)…</span>
          </CommandItem>
          <CommandItem
            disabled={!currentProjectId}
            onSelect={() =>
              run(() => currentProjectId && openProjectDialog('duplicate', currentProjectId))
            }
            data-testid="cmd-duplicate-project"
          >
            <Copy />
            <span>Duplicate project…</span>
          </CommandItem>
          <CommandItem
            disabled={!currentProjectId}
            onSelect={() =>
              run(() => currentProjectId && openProjectDialog('delete', currentProjectId))
            }
            data-testid="cmd-delete-project"
          >
            <Trash2 />
            <span>Delete project…</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <CommandItem
              key={f.id}
              onSelect={() => run(() => setStatusFilter(f.id))}
              data-testid={`cmd-filter-${f.id}`}
            >
              <Filter />
              <span>Show {f.label.toLowerCase()}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </>
    )
  }, [
    inEditor,
    editorActions,
    reviewMode,
    run,
    setSidebarTab,
    setSidebarOpen,
    setStatusFilter,
    toggleReviewMode,
    togglePanel,
    openFindReplace,
    openAnalysis,
    openAddTerm,
    openConcordance,
    openProjectDialog,
    currentProjectId,
    webSearchProviders,
  ])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" data-testid="cmd-input" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem
            onSelect={() => run(() => navigate('/'))}
            data-testid="cmd-nav-projects"
          >
            <FolderOpen />
            <span>Go to Projects</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => navigate('/tm'))}
            data-testid="cmd-nav-tm"
          >
            <Database />
            <span>Go to Translation Memory</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => navigate('/terminology'))}
            data-testid="cmd-nav-glossary"
          >
            <BookA />
            <span>Go to Glossary</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/settings'))}>
            <Settings />
            <span>Go to Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => run(() => openImport(true))}
            data-testid="cmd-import"
          >
            <FilePlus />
            <span>Import file…</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => toggleTheme())} data-testid="cmd-toggle-theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
            <span>Toggle theme (currently {theme})</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => openShortcuts(true))}
            data-testid="cmd-shortcuts"
          >
            <Keyboard />
            <span>Show keyboard shortcuts</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {editorItems && <CommandSeparator />}
        {editorItems}

        {projects && projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name}`}
                  onSelect={() => run(() => navigate(`/project/${p.id}`))}
                  data-testid={`cmd-project-${p.id}`}
                >
                  <FileText />
                  <span>{p.name}</span>
                  <CommandShortcut>
                    {p.sourceLang} → {p.targetLang}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

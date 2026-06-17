import { useEffect } from 'react'
import { useCommandPaletteStore } from './useCommandPaletteStore'
import { useEditorModeStore } from '@/features/editor/useEditorModeStore'
import { useQuickLookupStore } from '@/features/lookup/useQuickLookupStore'
import { useShortcutsStore } from '@/features/shortcuts/useShortcutsStore'
import { useEditorActionsStore } from '@/features/editor/useEditorActionsStore'
import { useFindReplaceStore } from '@/features/editor/findReplace/useFindReplaceStore'
import { useAddTermStore } from '@/features/editor/glossary/useAddTermStore'
import { useConcordanceStore } from '@/features/editor/concordance/useConcordanceStore'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Selected text in the focused input/textarea, or the document selection. */
function activeSelectionText(): string {
  const el = document.activeElement
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const { selectionStart, selectionEnd, value } = el
    if (selectionStart != null && selectionEnd != null && selectionEnd > selectionStart) {
      return value.slice(selectionStart, selectionEnd)
    }
  }
  return window.getSelection?.()?.toString() ?? ''
}

export function useGlobalShortcuts() {
  const toggle = useCommandPaletteStore((s) => s.toggle)
  const toggleReviewMode = useEditorModeStore((s) => s.toggleReviewMode)
  const openLookup = useQuickLookupStore((s) => s.openWith)
  const toggleShortcuts = useShortcutsStore((s) => s.toggle)
  const toggleFindReplace = useFindReplaceStore((s) => s.toggle)
  const openAddTerm = useAddTermStore((s) => s.openWith)
  const openConcordance = useConcordanceStore((s) => s.openWith)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // "?" cheat-sheet — only when the user isn't typing into a field.
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        toggleShortcuts()
        return
      }
      // Alt+↓ / Alt+Shift+↓ — jump to next untranslated / next draft.
      // Works even with focus inside the textarea so reviewers can keep typing
      // and skip to the next thing without grabbing the mouse.
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowDown') {
        const actions = useEditorActionsStore.getState().actions
        if (!actions) return
        e.preventDefault()
        actions.jumpToNextWithStatus(e.shiftKey ? 'draft' : 'untranslated')
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'k' || e.key === 'K') {
        if (e.shiftKey) {
          e.preventDefault()
          openConcordance(activeSelectionText().trim())
          return
        }
        e.preventDefault()
        toggle()
        return
      }
      if (e.key === 'l' || e.key === 'L') {
        if (e.shiftKey) return
        e.preventDefault()
        openLookup()
        return
      }
      if (e.key === 'h' || e.key === 'H') {
        if (e.shiftKey) return
        e.preventDefault()
        toggleFindReplace()
        return
      }
      if (e.key === 'e' || e.key === 'E') {
        if (e.shiftKey) return
        e.preventDefault()
        openAddTerm(activeSelectionText().trim())
        return
      }
      if (e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        toggleReviewMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    toggle,
    toggleReviewMode,
    openLookup,
    toggleShortcuts,
    toggleFindReplace,
    openAddTerm,
    openConcordance,
  ])
}

export function GlobalShortcuts() {
  useGlobalShortcuts()
  return null
}

import { useEffect } from 'react'
import { useCommandPaletteStore } from './useCommandPaletteStore'
import { useEditorModeStore } from '@/features/editor/useEditorModeStore'
import { useQuickLookupStore } from '@/features/lookup/useQuickLookupStore'
import { useShortcutsStore } from '@/features/shortcuts/useShortcutsStore'
import { useEditorActionsStore } from '@/features/editor/useEditorActionsStore'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useGlobalShortcuts() {
  const toggle = useCommandPaletteStore((s) => s.toggle)
  const toggleReviewMode = useEditorModeStore((s) => s.toggleReviewMode)
  const openLookup = useQuickLookupStore((s) => s.openWith)
  const toggleShortcuts = useShortcutsStore((s) => s.toggle)

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
        if (e.shiftKey) return
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
      if (e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        toggleReviewMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle, toggleReviewMode, openLookup, toggleShortcuts])
}

export function GlobalShortcuts() {
  useGlobalShortcuts()
  return null
}

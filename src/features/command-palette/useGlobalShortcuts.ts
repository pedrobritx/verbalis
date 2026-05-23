import { useEffect } from 'react'
import { useCommandPaletteStore } from './useCommandPaletteStore'
import { useEditorModeStore } from '@/features/editor/useEditorModeStore'

export function useGlobalShortcuts() {
  const toggle = useCommandPaletteStore((s) => s.toggle)
  const toggleReviewMode = useEditorModeStore((s) => s.toggleReviewMode)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'k' || e.key === 'K') {
        if (e.shiftKey) return
        e.preventDefault()
        toggle()
        return
      }
      if (e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        toggleReviewMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle, toggleReviewMode])
}

export function GlobalShortcuts() {
  useGlobalShortcuts()
  return null
}

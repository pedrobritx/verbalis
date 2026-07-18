import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  PASTE_COMMAND,
  CUT_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
} from 'lexical'
import { useEditorModeStore } from '../useEditorModeStore'
import { useLocalAuthor } from '../useLocalAuthor'
import { $insertSuggestion, $deleteSuggestion, type SuggestionAuthor } from './suggest'

/**
 * When the editor is in suggesting mode, intercept the text-mutating commands so
 * edits become tracked changes instead of direct mutations (ROADMAP §3 D1–D3).
 * Registered at CRITICAL priority so it runs before RichTextPlugin's defaults;
 * returns false (no-op) in direct mode, while composing (IME), or before the
 * author id is minted, keeping direct-mode behaviour byte-identical.
 */
export function TrackedChangesPlugin({ locked }: { locked?: boolean }) {
  const [editor] = useLexicalComposerContext()
  const editMode = useEditorModeStore((s) => s.editMode)
  const author = useLocalAuthor()

  const activeRef = useRef(false)
  const authorRef = useRef<SuggestionAuthor>(author)
  activeRef.current = editMode === 'suggesting' && !locked
  authorRef.current = author

  useEffect(() => {
    // Only intercept when suggesting, not mid-IME-composition, and once the
    // stable author id exists (it is minted on mount within a tick).
    const suggesting = () =>
      activeRef.current && !editor.isComposing() && !!authorRef.current.authorId

    // Command listeners already run inside the editor's update cycle, so the
    // `$`-helpers are called directly here. Wrapping them in a nested
    // `editor.update` let the native beforeinput insertion slip through on the
    // first keystroke (producing a duplicated leading character).
    const unregister = [
      editor.registerCommand(
        CONTROLLED_TEXT_INSERTION_COMMAND,
        (payload) => {
          if (!suggesting() || typeof payload !== 'string' || !payload) return false
          return $insertSuggestion(payload, authorRef.current)
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          if (!suggesting()) return false
          event?.preventDefault()
          return $deleteSuggestion('backward', authorRef.current)
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        (event) => {
          if (!suggesting()) return false
          event?.preventDefault()
          return $deleteSuggestion('forward', authorRef.current)
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!suggesting()) return false
          const clip = event as ClipboardEvent
          const text = clip.clipboardData?.getData('text/plain')
          if (!text) return false
          clip.preventDefault()
          return $insertSuggestion(text, authorRef.current)
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CUT_COMMAND,
        (event) => {
          if (!suggesting()) return false
          const clip = event as ClipboardEvent
          // Copy the selection to the clipboard ourselves, then turn the removal
          // into a suggested deletion instead of a real cut.
          const sel = $getSelection()
          if ($isRangeSelection(sel) && !sel.isCollapsed()) {
            clip.clipboardData?.setData('text/plain', sel.getTextContent())
          }
          clip.preventDefault()
          return $deleteSuggestion('backward', authorRef.current)
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    ]
    return () => unregister.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return null
}

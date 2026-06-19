import { useEffect, useRef, useState } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from 'lexical'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { RICH_NAMESPACE, RICH_THEME, prepopulatePlain } from '@/core/editor/richText'
import type { SegmentStatus } from '@/core/types'
import type { SegmentEditorHandle } from '../SegmentEditorHandle'
import { autosaveStatus } from '../segmentAutosave'
import { FormatToolbar } from './FormatToolbar'

const SAVE_DELAY_MS = 300

export interface RichSegmentEditorProps {
  segmentId: string
  index: number
  initialPlain: string
  initialRich?: string
  /** Live DB target/targetRich, to detect external changes (TM/MT apply). */
  externalPlain: string
  externalRich?: string
  status: SegmentStatus
  locked: boolean
  isBilingual: boolean
  canJoinNext: boolean
  registerHandle: (handle: SegmentEditorHandle | null) => void
  onFocus: () => void
  onConfirm: () => void
  onToggleReviewed: () => void
  onJoin: () => void
  onMoveFocus: (direction: -1 | 1) => void
}

export function RichSegmentEditor(props: RichSegmentEditorProps) {
  const { index, initialPlain, initialRich, locked } = props
  const [focused, setFocused] = useState(false)

  const initialConfig = {
    namespace: RICH_NAMESPACE,
    theme: RICH_THEME,
    editable: !locked,
    onError: (error: Error) => console.warn('Lexical error', error),
    editorState: initialRich ?? prepopulatePlain(initialPlain),
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex flex-col gap-1">
        {focused && !locked && <FormatToolbar />}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                data-testid={`target-${index}`}
                ariaLabel={`Translation ${index + 1}`}
                ariaDescribedBy={`seg-${index}-counter`}
                onFocus={() => {
                  setFocused(true)
                  props.onFocus()
                }}
                onBlur={() => setFocused(false)}
                className="rsg-editor min-h-[2.5rem] w-full rounded-md border bg-transparent px-3 py-2 text-sm whitespace-pre-wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  opacity: locked ? 0.7 : 1,
                }}
              />
            }
            placeholder={
              <div
                className="pointer-events-none absolute left-3 top-2 text-sm select-none"
                style={{ color: 'var(--color-muted)' }}
              >
                {locked ? 'Locked' : 'Translation…'}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin />
      <EditorLogic {...props} />
    </LexicalComposer>
  )
}

function EditorLogic(props: RichSegmentEditorProps) {
  const [editor] = useLexicalComposerContext()

  // Latest mutable props kept in refs so the command/listener registrations
  // below stay stable (registered once per editor) yet always see fresh values.
  const propsRef = useRef(props)
  propsRef.current = props

  const lastSavedPlainRef = useRef(props.initialPlain)
  const lastSavedRichRef = useRef<string | undefined>(props.initialRich)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reflect lock changes onto the editor's editability after mount.
  useEffect(() => {
    editor.setEditable(!props.locked)
  }, [editor, props.locked])

  // Register listeners and command handlers once for this editor.
  useEffect(() => {
    const computeRich = () => JSON.stringify(editor.getEditorState().toJSON())
    const computePlain = () =>
      editor.getEditorState().read(() => $getRoot().getTextContent())

    // Seed the "last saved" baseline from the mounted state so a benign initial
    // update never triggers a write.
    lastSavedRichRef.current = computeRich()
    lastSavedPlainRef.current = computePlain()

    const flushSave = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (propsRef.current.locked) return
      const plain = computePlain()
      const rich = computeRich()
      if (rich === lastSavedRichRef.current) return
      lastSavedPlainRef.current = plain
      lastSavedRichRef.current = rich
      const changes: Record<string, unknown> = { target: plain, targetRich: rich }
      const nextStatus = autosaveStatus(plain, propsRef.current.status)
      if (nextStatus) changes.status = nextStatus
      void segmentRepo.update(propsRef.current.segmentId, changes)
    }

    const scheduleSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(flushSave, SAVE_DELAY_MS)
    }

    const unregisters = [
      editor.registerUpdateListener(({ editorState, prevEditorState }) => {
        // Skip selection-only changes (node tree unchanged).
        if (editorState.toJSON && prevEditorState) {
          const rich = JSON.stringify(editorState.toJSON())
          if (rich === lastSavedRichRef.current) return
          scheduleSave()
        }
      }),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const e = event as KeyboardEvent | null
          if (!e) return false
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault()
            flushSave()
            propsRef.current.onToggleReviewed()
            return true
          }
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (propsRef.current.locked) return true
            flushSave()
            propsRef.current.onConfirm()
            return true
          }
          // Plain Enter inserts a line break (parity with the textarea), not a
          // new paragraph.
          e.preventDefault()
          editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          const e = event as KeyboardEvent | null
          if (e && !e.shiftKey) {
            e.preventDefault()
            propsRef.current.onMoveFocus(1)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const e = event as KeyboardEvent | null
          if (e && !e.shiftKey) {
            e.preventDefault()
            propsRef.current.onMoveFocus(-1)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerRootListener((rootElement, prevRootElement) => {
        if (prevRootElement) prevRootElement.removeEventListener('keydown', onJoinKey)
        if (rootElement) rootElement.addEventListener('keydown', onJoinKey)
      }),
    ]

    function onJoinKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        const p = propsRef.current
        if (!p.isBilingual && p.canJoinNext) {
          flushSave()
          p.onJoin()
        }
      }
    }

    const handle: SegmentEditorHandle = {
      focus: () => editor.focus(),
      insertText: (text) => {
        editor.update(() => {
          let sel = $getSelection()
          if (!$isRangeSelection(sel)) {
            $getRoot().selectEnd()
            sel = $getSelection()
          }
          if ($isRangeSelection(sel)) sel.insertText(text)
        })
      },
    }
    propsRef.current.registerHandle(handle)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      unregisters.forEach((u) => u())
      propsRef.current.registerHandle(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // When the DB target diverges from what we last saved, an external action
  // (TM/MT apply, which clears targetRich) changed it — rebuild the editor.
  useEffect(() => {
    if (
      props.externalRich === lastSavedRichRef.current &&
      props.externalPlain === lastSavedPlainRef.current
    ) {
      return
    }
    if (props.externalRich) {
      try {
        editor.setEditorState(editor.parseEditorState(props.externalRich))
      } catch {
        rebuildFromPlain(editor, props.externalPlain)
      }
    } else {
      rebuildFromPlain(editor, props.externalPlain)
    }
    lastSavedPlainRef.current = props.externalPlain
    lastSavedRichRef.current =
      props.externalRich ?? JSON.stringify(editor.getEditorState().toJSON())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.externalPlain, props.externalRich])

  return null
}

function rebuildFromPlain(editor: LexicalEditor, text: string) {
  editor.update(() => {
    const root = $getRoot()
    root.clear()
    const paragraph = $createParagraphNode()
    if (text) paragraph.append($createTextNode(text))
    root.append(paragraph)
  })
}

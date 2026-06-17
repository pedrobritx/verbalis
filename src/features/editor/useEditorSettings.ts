import { useLiveQuery } from 'dexie-react-hooks'
import {
  DEFAULT_EDITOR_SETTINGS,
  EDITOR_SETTINGS_KEY,
  mergeEditorSettings,
  settingsRepo,
  type EditorSettings,
} from '@/storage/repositories/settingsRepo'
import { DEFAULT_QA_RULES } from '@/core/qa/types'

/** Live editor preferences, falling back to defaults until the row loads. */
export function useEditorSettings(): EditorSettings {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<EditorSettings>>(EDITOR_SETTINGS_KEY),
    [],
  )
  return stored
    ? mergeEditorSettings(stored)
    : { ...DEFAULT_EDITOR_SETTINGS, qaRules: { ...DEFAULT_QA_RULES } }
}

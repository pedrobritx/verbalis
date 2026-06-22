import { db } from '@/storage/db'
import type { LookupSettings, MTSettings, SemanticTMSettings } from '@/core/types'
import { DEFAULT_QA_RULES, type QARuleToggles } from '@/core/qa/types'
import {
  DEFAULT_AUTOCORRECT_SETTINGS,
  type AutocorrectSettings,
} from '@/core/text/autocorrect'
import {
  DEFAULT_WEB_SEARCH_SETTINGS,
  type WebSearchSettings,
} from '@/core/websearch/providers'

export const MT_SETTINGS_KEY = 'mt.providers'
export const SEMANTIC_TM_KEY = 'tm.semantic'
export const LOOKUP_SETTINGS_KEY = 'lookup.defaults'
export const EDITOR_SETTINGS_KEY = 'editor.prefs'
export const PROFILE_SETTINGS_KEY = 'profile.identity'
export const WEB_SEARCH_SETTINGS_KEY = 'websearch.providers'
export const SPELL_SETTINGS_KEY = 'spell.dicts'

/** On-device spell-check. The active dictionary follows the project target lang. */
export interface SpellSettings {
  enabled: boolean
  /** Personal dictionary — words the user marked correct, fed to the checker. */
  personalWords: string[]
}

export const DEFAULT_SPELL_SETTINGS: SpellSettings = {
  enabled: false,
  personalWords: [],
}

/**
 * Local identity for authored actions (comments today; tracked changes and
 * collaboration peers later). Stays on-device like everything else.
 */
export interface ProfileSettings {
  /** Name attached to comments and, later, tracked changes / sync peers. */
  displayName: string
}

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  displayName: '',
}

export interface EditorSettings {
  /** Auto-fill identical untranslated segments when one is confirmed. */
  autoPropagate: boolean
  /** Minimum TM match score (0–1) used by batch pre-translation. */
  pretranslateThreshold: number
  /** Per-rule enable flags for Quality Assurance. */
  qaRules: QARuleToggles
  /**
   * Use the rich-text target editor (bold/italic/underline/sub-sup, case
   * transforms) instead of the plain textarea. Opt-in while the rich editor
   * foundation matures; code segments always stay plain.
   */
  richEditing: boolean
  /** AutoCorrect / abbreviation expansion applied as the translator types. */
  autocorrect: AutocorrectSettings
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  autoPropagate: true,
  pretranslateThreshold: 0.75,
  qaRules: { ...DEFAULT_QA_RULES },
  richEditing: false,
  autocorrect: DEFAULT_AUTOCORRECT_SETTINGS,
}

export const DEFAULT_LOOKUP_SETTINGS: LookupSettings = {
  defaultTargetLang: 'en',
}

export const DEFAULT_MT_SETTINGS: MTSettings = {
  default: 'mymemory',
  mymemory: {
    enabled: true,
    endpoint: 'https://api.mymemory.translated.net/get',
    email: '',
  },
  ollama: {
    enabled: false,
    endpoint: 'http://localhost:11434',
    model: 'llama3.1:8b-instruct-q4_K_M',
  },
  claude: {
    enabled: false,
    apiKey: '',
    model: 'claude-haiku-4-5-20251001',
  },
  libretranslate: {
    enabled: false,
    endpoint: 'https://libretranslate.com/translate',
    apiKey: '',
  },
}

export const DEFAULT_SEMANTIC_TM: SemanticTMSettings = {
  enabled: false,
  model: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  threshold: 0.75,
}

export const settingsRepo = {
  get: async <T>(key: string): Promise<T | undefined> => {
    const row = await db.settings.get(key)
    return row?.value as T | undefined
  },
  set: <T>(key: string, value: T) => db.settings.put({ key, value }),
  delete: (key: string) => db.settings.delete(key),
  getAll: () => db.settings.toArray(),
}

export async function getMTSettings(): Promise<MTSettings> {
  const stored = await settingsRepo.get<Partial<MTSettings>>(MT_SETTINGS_KEY)
  return mergeMTSettings(stored)
}

export function mergeMTSettings(stored: Partial<MTSettings> | undefined): MTSettings {
  if (!stored) return { ...DEFAULT_MT_SETTINGS }
  return {
    default: stored.default ?? DEFAULT_MT_SETTINGS.default,
    mymemory: { ...DEFAULT_MT_SETTINGS.mymemory, ...(stored.mymemory ?? {}) },
    ollama: { ...DEFAULT_MT_SETTINGS.ollama, ...(stored.ollama ?? {}) },
    claude: { ...DEFAULT_MT_SETTINGS.claude, ...(stored.claude ?? {}) },
    libretranslate: { ...DEFAULT_MT_SETTINGS.libretranslate, ...(stored.libretranslate ?? {}) },
  }
}

export function mergeSemanticTMSettings(
  stored: Partial<SemanticTMSettings> | undefined,
): SemanticTMSettings {
  if (!stored) return { ...DEFAULT_SEMANTIC_TM }
  return { ...DEFAULT_SEMANTIC_TM, ...stored }
}

export async function getSemanticTMSettings(): Promise<SemanticTMSettings> {
  const stored = await settingsRepo.get<Partial<SemanticTMSettings>>(SEMANTIC_TM_KEY)
  return mergeSemanticTMSettings(stored)
}

export function mergeLookupSettings(
  stored: Partial<LookupSettings> | undefined,
): LookupSettings {
  if (!stored) return { ...DEFAULT_LOOKUP_SETTINGS }
  return { ...DEFAULT_LOOKUP_SETTINGS, ...stored }
}

export async function getLookupSettings(): Promise<LookupSettings> {
  const stored = await settingsRepo.get<Partial<LookupSettings>>(LOOKUP_SETTINGS_KEY)
  return mergeLookupSettings(stored)
}

export function mergeEditorSettings(stored: Partial<EditorSettings> | undefined): EditorSettings {
  if (!stored)
    return {
      ...DEFAULT_EDITOR_SETTINGS,
      qaRules: { ...DEFAULT_QA_RULES },
      autocorrect: { ...DEFAULT_AUTOCORRECT_SETTINGS },
    }
  return {
    autoPropagate: stored.autoPropagate ?? DEFAULT_EDITOR_SETTINGS.autoPropagate,
    pretranslateThreshold:
      stored.pretranslateThreshold ?? DEFAULT_EDITOR_SETTINGS.pretranslateThreshold,
    qaRules: { ...DEFAULT_QA_RULES, ...(stored.qaRules ?? {}) },
    richEditing: stored.richEditing ?? DEFAULT_EDITOR_SETTINGS.richEditing,
    autocorrect: {
      enabled: stored.autocorrect?.enabled ?? DEFAULT_AUTOCORRECT_SETTINGS.enabled,
      rules: stored.autocorrect?.rules ?? DEFAULT_AUTOCORRECT_SETTINGS.rules,
    },
  }
}

export async function getEditorSettings(): Promise<EditorSettings> {
  const stored = await settingsRepo.get<Partial<EditorSettings>>(EDITOR_SETTINGS_KEY)
  return mergeEditorSettings(stored)
}

export function setEditorSettings(settings: EditorSettings): Promise<unknown> {
  return settingsRepo.set(EDITOR_SETTINGS_KEY, settings)
}

export function mergeProfileSettings(
  stored: Partial<ProfileSettings> | undefined,
): ProfileSettings {
  if (!stored) return { ...DEFAULT_PROFILE_SETTINGS }
  return { ...DEFAULT_PROFILE_SETTINGS, ...stored }
}

export async function getProfileSettings(): Promise<ProfileSettings> {
  const stored = await settingsRepo.get<Partial<ProfileSettings>>(PROFILE_SETTINGS_KEY)
  return mergeProfileSettings(stored)
}

export function mergeWebSearchSettings(
  stored: Partial<WebSearchSettings> | undefined,
): WebSearchSettings {
  if (!stored?.providers) return { ...DEFAULT_WEB_SEARCH_SETTINGS }
  return { providers: stored.providers }
}

export async function getWebSearchSettings(): Promise<WebSearchSettings> {
  const stored = await settingsRepo.get<Partial<WebSearchSettings>>(WEB_SEARCH_SETTINGS_KEY)
  return mergeWebSearchSettings(stored)
}

export function mergeSpellSettings(stored: Partial<SpellSettings> | undefined): SpellSettings {
  if (!stored) return { ...DEFAULT_SPELL_SETTINGS, personalWords: [] }
  return {
    enabled: stored.enabled ?? DEFAULT_SPELL_SETTINGS.enabled,
    personalWords: stored.personalWords ?? [],
  }
}

export async function getSpellSettings(): Promise<SpellSettings> {
  const stored = await settingsRepo.get<Partial<SpellSettings>>(SPELL_SETTINGS_KEY)
  return mergeSpellSettings(stored)
}

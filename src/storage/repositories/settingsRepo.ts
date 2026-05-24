import { db } from '@/storage/db'
import type { LookupSettings, MTSettings, SemanticTMSettings } from '@/core/types'

export const MT_SETTINGS_KEY = 'mt.providers'
export const SEMANTIC_TM_KEY = 'tm.semantic'
export const LOOKUP_SETTINGS_KEY = 'lookup.defaults'

export const DEFAULT_LOOKUP_SETTINGS: LookupSettings = {
  defaultTargetLang: 'en',
}

export const DEFAULT_MT_SETTINGS: MTSettings = {
  default: undefined,
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

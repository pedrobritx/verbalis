export interface Project {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  createdAt: string
  updatedAt: string
}

export type SegmentStatus = 'untranslated' | 'draft' | 'translated' | 'reviewed' | 'locked'

export type SegmentBlockKind = 'paragraph' | 'heading' | 'list_item' | 'blockquote' | 'code'

export interface SegmentSourceMeta {
  kind: SegmentBlockKind
  depth?: number
  ordered?: boolean
  lang?: string
  blockIndex: number
  sentenceIndex: number
}

export interface Segment {
  id: string
  projectId: string
  index: number
  source: string
  target: string
  status: SegmentStatus
  sourceMeta?: SegmentSourceMeta
  note?: string
  createdAt: string
  updatedAt: string
}

export interface TMEntry {
  id: string
  source: string
  target: string
  sourceLang: string
  targetLang: string
  projectId?: string
  date: string
}

export interface TMMatch {
  entry: TMEntry
  score: number
  isExact: boolean
  similarityMethod?: 'lexical' | 'semantic'
}

export interface GlossaryEntry {
  id: string
  term: string
  definition: string
  translations: Record<string, string>
  notes?: string
  projectId?: string
}

export type MTProviderId = 'mymemory' | 'ollama' | 'claude' | 'libretranslate'

export interface OllamaSettings {
  enabled: boolean
  endpoint: string
  model: string
}

export interface ClaudeSettings {
  enabled: boolean
  apiKey: string
  model: string
}

export interface LibreTranslateSettings {
  enabled: boolean
  endpoint: string
  apiKey?: string
}

export interface MyMemorySettings {
  enabled: boolean
  endpoint: string
  email?: string
}

export interface MTSettings {
  default?: MTProviderId
  mymemory: MyMemorySettings
  ollama: OllamaSettings
  claude: ClaudeSettings
  libretranslate: LibreTranslateSettings
}

export interface SemanticTMSettings {
  enabled: boolean
  model: string
  threshold: number
}

export interface EmbeddingRecord {
  id: string
  tmId: string
  model: string
  dim: number
  vector: Float32Array
  createdAt: string
}

export interface LookupSettings {
  defaultTargetLang: string
  lastSourceLang?: string
}

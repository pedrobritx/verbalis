export interface BilingualProjectMeta {
  format: 'xliff12'
  originalFile?: string
  datatype?: string
}

export interface Project {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  createdAt: string
  updatedAt: string
  bilingualMeta?: BilingualProjectMeta
}

/**
 * The full original bilingual document for an XLIFF project, kept in its own
 * table (keyed by project id) rather than inline on the project row. It can be
 * the entire source file, so storing it separately keeps the projects list and
 * command palette — which only need the lightweight project metadata — fast.
 * exportBilingual() re-uses it as a template so trans-unit-level attributes from
 * the originating CAT tool (memoQ mq:* namespace, OmegaT notes, skeleton refs,
 * …) survive round-tripping.
 */
export interface ProjectTemplate {
  projectId: string
  templateXml: string
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

export interface BilingualSegmentMeta {
  transUnitId: string
  // Preserves the original XLIFF state when it is not one of the values
  // statusToXliffState would round-trip to (e.g. tool-specific extensions).
  rawState?: string
  // Original XML for each inline tag in the source, keyed by the numeric
  // placeholder id that replaces it in the editable text.
  inlineTags?: Record<string, string>
}

/**
 * A threaded note attached to a segment. Stored inline on the segment (not its
 * own table) because comments are always read and written alongside their
 * segment and never queried independently. The shape is intentionally close to
 * what real-time collaboration will need later (author identity, timestamps,
 * resolve state) so the data layer does not have to change when sync lands.
 */
export interface SegmentComment {
  id: string
  body: string
  /** Display name of the author, when a profile identity is set. */
  author?: string
  createdAt: string
  resolved?: boolean
}

export interface Segment {
  id: string
  projectId: string
  index: number
  source: string
  target: string
  /**
   * Serialized Lexical editor state (JSON) when the target was edited in rich
   * mode. `target` always holds the derived plain text and stays the source of
   * truth for TM matching, QA, search and counters; `targetRich` is the
   * formatting/inline-tag layer on top. Absent for plain-text targets.
   */
  targetRich?: string
  status: SegmentStatus
  /**
   * Lock flag, orthogonal to `status`: a locked segment keeps its translation
   * status but is read-only and excluded from batch operations (pre-translate,
   * number population, auto-propagation). Kept separate from the `locked`
   * status value so locking a reviewed segment doesn't discard that it was
   * reviewed.
   */
  locked?: boolean
  sourceMeta?: SegmentSourceMeta
  bilingualMeta?: BilingualSegmentMeta
  note?: string
  comments?: SegmentComment[]
  createdAt: string
  updatedAt: string
}

/**
 * A point-in-time snapshot of a project's segment set, captured from its Yjs
 * document. `snapshot` is a self-contained `Y.encodeStateAsUpdateV2` blob: a
 * version can be restored by applying it into a fresh doc, and two versions
 * diffed by loading both. `named` versions are the user's explicit "Save
 * version" beats (and milestone confirms); `auto` versions are the throttled
 * safety net and are pruned to a cap. Per-segment "row history" is derived by
 * decoding these blobs — no separate per-segment store is kept.
 */
export interface ProjectVersion {
  id: string
  projectId: string
  /** User-facing label; set for `named` versions, absent for `auto`. */
  label?: string
  kind: 'named' | 'auto'
  /** `Y.encodeStateAsUpdateV2(doc)` at capture time. */
  snapshot: Uint8Array
  /** Number of segments in the snapshot, for display without decoding. */
  segmentCount: number
  /** Display name of the local identity that captured the version, if set. */
  author?: string
  createdAt: string
}

export interface TMEntry {
  id: string
  source: string
  target: string
  sourceLang: string
  targetLang: string
  projectId?: string
  date: string
  // Set when this entry was seeded from a bundled terminology corpus, so the
  // pack (and only its entries) can be removed cleanly on uninstall.
  corpusId?: string
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

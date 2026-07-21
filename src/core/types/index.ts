export interface BilingualProjectMeta {
  format: 'xliff12'
  originalFile?: string
  datatype?: string
}

/** Role a member holds on a cloud project (ROADMAP §4.1, D8). */
export type ProjectRole = 'project_manager' | 'translator' | 'revisor'

/** Project-level workflow stage that gates editing per role (ROADMAP §5.2). */
export type WorkflowStage = 'translation' | 'review' | 'final'

export interface Project {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  createdAt: string
  updatedAt: string
  bilingualMeta?: BilingualProjectMeta
  /**
   * Cloud publication link (ROADMAP §4.1). Present once the project is published
   * to — or opened from — Supabase; absent for local-only projects. `id` is the
   * cloud `projects` row id; `role` is this user's role in it. `stage`/`deadline`
   * carry the §5.2 workflow snapshot read on open. Additive and unindexed:
   * local-only projects never carry it (they are "PM-of-self", fully permissive).
   */
  cloud?: { id: string; role: ProjectRole; stage?: WorkflowStage; deadline?: string | null }
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
  /**
   * Reply threading: the id of the root comment this is a reply to. Root
   * comments leave this undefined. All additive/optional — no migration.
   */
  parentId?: string
  /**
   * Links a root comment to a highlighted text range in `targetRich` via the
   * matching CommentMarkNode's anchor id. Undefined for plain, un-anchored
   * segment-level comments (the legacy shape, still supported).
   */
  anchorId?: string
  /** The text the comment was anchored to, kept for context in list views. */
  quote?: string
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
  /**
   * Links this segment to its structural {@link Block} in the document model
   * (Milestone 2). Unindexed and additive; absent for XLIFF projects, which have
   * no document tree. Set at import and by the v6 backfill.
   */
  blockId?: string
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
  /**
   * Stable author id (from `profile.identity`) that captured the version — the
   * same identity used by tracked-change marks, comments, and presence, so
   * attribution is unified across the app (ROADMAP §5.3, D8).
   */
  authorId?: string
  /**
   * Set on a revisor/PM **sign-off** version: who approved the project and when.
   * Its presence marks the version as an approval milestone in the timeline.
   */
  approval?: { authorId: string; authorName: string; at: string }
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
  // pack (and only its entries) can be removed cleanly on uninstall. Corpus-seeded
  // rows are excluded from cloud sync (3.4) — only the user's own TM syncs.
  corpusId?: string
  /**
   * Epoch-ms of the last local write, stamped by `tmRepo` (3.4). Drives per-row
   * last-write-wins when a signed-in device reconciles its personal TM with the
   * cloud. Optional for backward compatibility; the Dexie v7 upgrade backfills it.
   */
  updatedAt?: number
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
  /**
   * Epoch-ms of the last local write, stamped by `glossaryRepo` (3.4). Drives
   * per-row last-write-wins when a signed-in device reconciles its personal term
   * bank with the cloud. Optional; the Dexie v7 upgrade backfills it.
   */
  updatedAt?: number
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

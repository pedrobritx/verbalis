import type { SegmentBlockKind } from '@/core/types'

/**
 * The document/block model (Milestone 2, ROADMAP §3 D5). A layer *above* the flat
 * segment list that records source structure — headings, lists, quotes, tables,
 * images — so a translated document can be previewed and reconstructed (DOCX
 * export). Segments stay the unit of translation/TM/QA/sync and link up to a
 * block via `Segment.blockId`; blocks are immutable after import in v1 and are
 * not mirrored into Yjs.
 */

/** Block kinds: the sentence-bearing kinds plus structural table/image blocks. */
export type BlockKind = SegmentBlockKind | 'table' | 'image'

/** A run of inline text with optional character formatting (from DOCX import). */
export interface InlineRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  sub?: boolean
  sup?: boolean
  /** Hyperlink target, when the run is a link. */
  href?: string
}

/** Extra per-block payload: table cells (rows → cells → runs) or an image ref. */
export interface BlockAttrs {
  /** For `table` blocks: rows of cells, each cell a run list. */
  rows?: InlineRun[][][]
  /** For `image` blocks: the asset id + alt text. */
  assetId?: string
  alt?: string
  /** Heading level (1–6) for `heading` blocks, when known. */
  level?: number
}

/** A structural block of a document, above the segments it was split into. */
export interface Block {
  id: string
  documentId: string
  projectId: string
  /** 0-based position within the document (mirrors `sourceMeta.blockIndex`). */
  index: number
  kind: BlockKind
  /** Nesting depth for list items / quotes. */
  depth?: number
  /** Ordered vs unordered, for `list_item` blocks. */
  ordered?: boolean
  /** Source inline runs (formatting), when captured at import (DOCX). */
  sourceRuns?: InlineRun[]
  attrs?: BlockAttrs
}

/** The document a project's segments belong to (monolingual projects only). */
export interface DocumentEntity {
  id: string
  projectId: string
  name: string
  /** Origin format ('txt' | 'md' | 'docx' | 'unknown' for backfilled projects). */
  sourceFormat: string
  createdAt: string
  updatedAt: string
}

/** A binary asset referenced by the document — an embedded image or the
 *  original imported file kept for future higher-fidelity re-processing. */
export interface Asset {
  id: string
  documentId: string
  projectId: string
  kind: 'image' | 'original'
  mime: string
  blob: Blob
  name?: string
}

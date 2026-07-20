import Dexie, { type Table, type Transaction } from 'dexie'
import type {
  Project,
  ProjectTemplate,
  ProjectVersion,
  Segment,
  TMEntry,
  GlossaryEntry,
  EmbeddingRecord,
} from '@/core/types'
import type { CorpusTerm, InstalledCorpusPack } from '@/core/corpus/types'
import type { DocumentEntity, Block, Asset } from '@/core/documents/model'
import { buildBlocksFromSegments } from '@/core/documents/fromSegments'

/** Which synced personal resource a tombstone belongs to (3.4). */
export type SyncResource = 'glossary' | 'tm'

/**
 * A record that a personal row was deleted locally (3.4). Because the row itself
 * is gone from its table, the sync needs this to push a soft-delete to the cloud
 * so the deletion propagates (and doesn't resurrect) across devices. Only written
 * while signed in; cleared once the delete has been pushed.
 */
export interface SyncTombstone {
  resource: SyncResource
  rowId: string
  /** Epoch-ms of the deletion — its last-write-wins timestamp. */
  deletedAt: number
}

export interface SettingsRow<T = unknown> {
  key: string
  value: T
  /**
   * Epoch-ms of the last local write, stamped by `settingsRepo.set` (3.3). Drives
   * per-key last-write-wins when a signed-in device reconciles with the cloud
   * `user_settings` table. Unindexed and optional — rows written before 3.3 (and
   * rows the sync never touches) simply lack it and read as "oldest".
   */
  updatedAt?: number
}

/**
 * v4 upgrade: relocate each XLIFF project's inline `bilingualMeta.templateXml`
 * into the dedicated `projectTemplates` table and strip it from the project row.
 * Exported so the migration can be exercised directly in tests.
 */
export async function migrateTemplatesToOwnTable(tx: Transaction): Promise<void> {
  const projects = tx.table('projects')
  const templates = tx.table('projectTemplates')
  const rows = (await projects.toArray()) as Array<
    Project & { bilingualMeta?: { templateXml?: string } & Record<string, unknown> }
  >
  for (const project of rows) {
    const meta = project.bilingualMeta
    const templateXml = meta?.templateXml
    if (meta && typeof templateXml === 'string') {
      await templates.put({ projectId: project.id, templateXml })
      delete meta.templateXml
      await projects.put(project)
    }
  }
}

/**
 * v6 upgrade: build the document/block model (Milestone 2) for existing
 * monolingual projects. Each project's segments are grouped by their
 * `sourceMeta.blockIndex` into blocks under one document, and each segment is
 * stamped with its `blockId`. XLIFF projects (no `sourceMeta`) are skipped —
 * they have no document tree. Exported so the migration is testable directly.
 */
export async function migrateDocumentBlocks(tx: Transaction): Promise<void> {
  const projects = (await tx.table('projects').toArray()) as Array<
    Project & { bilingualMeta?: { format?: string } }
  >
  const segmentsTable = tx.table('segments')
  const documentsTable = tx.table('documents')
  const blocksTable = tx.table('blocks')
  const now = new Date().toISOString()

  for (const project of projects) {
    if (project.bilingualMeta?.format === 'xliff12') continue
    const segments = (await segmentsTable
      .where('projectId')
      .equals(project.id)
      .toArray()) as Segment[]
    if (!segments.some((s) => s.sourceMeta)) continue

    const documentId = crypto.randomUUID()
    const { blocks, segmentBlockIds } = buildBlocksFromSegments(segments, {
      documentId,
      projectId: project.id,
    })
    if (blocks.length === 0) continue

    await documentsTable.put({
      id: documentId,
      projectId: project.id,
      name: project.name,
      sourceFormat: 'unknown',
      createdAt: now,
      updatedAt: now,
    } satisfies DocumentEntity)
    await blocksTable.bulkAdd(blocks)
    for (const seg of segments) {
      const blockId = segmentBlockIds.get(seg.id)
      if (blockId) await segmentsTable.update(seg.id, { blockId })
    }
  }
}

class VerbalisDB extends Dexie {
  projects!: Table<Project>
  projectTemplates!: Table<ProjectTemplate>
  segments!: Table<Segment>
  tm!: Table<TMEntry>
  glossary!: Table<GlossaryEntry>
  settings!: Table<SettingsRow>
  embeddings!: Table<EmbeddingRecord>
  corpusTerms!: Table<CorpusTerm>
  corpusPacks!: Table<InstalledCorpusPack>
  versions!: Table<ProjectVersion>
  documents!: Table<DocumentEntity>
  blocks!: Table<Block>
  assets!: Table<Asset>
  syncTombstones!: Table<SyncTombstone>

  constructor() {
    super('verbalis')
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      segments: 'id, projectId, index, status',
      tm: 'id, source, sourceLang, targetLang, projectId',
      glossary: 'id, term, projectId',
    })
    this.version(2).stores({
      projects: 'id, name, updatedAt',
      segments: 'id, projectId, index, status',
      tm: 'id, source, sourceLang, targetLang, projectId',
      glossary: 'id, term, projectId',
      settings: '&key',
      embeddings: 'id, tmId, model, [tmId+model]',
    })
    // v3: bundled terminology corpora. corpusTerms holds installed pack rows
    // (kept separate from the user's hand-curated glossary for performance);
    // corpusPacks tracks install state. tm gains a corpusId index so seeded
    // entries can be removed when a pack is uninstalled.
    this.version(3).stores({
      projects: 'id, name, updatedAt',
      segments: 'id, projectId, index, status',
      tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
      glossary: 'id, term, projectId',
      settings: '&key',
      embeddings: 'id, tmId, model, [tmId+model]',
      corpusTerms: 'id, corpusId',
      corpusPacks: 'id',
    })
    // v4: performance. Compound segment indexes let the projects list count
    // statuses (and the editor load segments in order) straight from the index
    // without materializing full segment rows. The bilingual XLIFF template —
    // potentially the entire original document — moves out of the project row
    // into its own table so listing projects no longer drags those blobs into
    // memory; it is only read when exporting.
    this.version(4)
      .stores({
        projects: 'id, name, updatedAt',
        projectTemplates: 'projectId',
        segments: 'id, projectId, index, status, [projectId+status], [projectId+index]',
        tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
        glossary: 'id, term, projectId',
        settings: '&key',
        embeddings: 'id, tmId, model, [tmId+model]',
        corpusTerms: 'id, corpusId',
        corpusPacks: 'id',
      })
      .upgrade(migrateTemplatesToOwnTable)
    // v5: version history (Foundation F2). Project snapshots are captured from
    // the per-project Yjs document (persisted outside Dexie via y-indexeddb) and
    // stored here as self-contained update blobs. Purely additive — a new table,
    // no upgrade callback, existing data untouched. The [projectId+createdAt]
    // index drives the timeline list and auto-snapshot pruning.
    this.version(5).stores({
      projects: 'id, name, updatedAt',
      projectTemplates: 'projectId',
      segments: 'id, projectId, index, status, [projectId+status], [projectId+index]',
      tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
      glossary: 'id, term, projectId',
      settings: '&key',
      embeddings: 'id, tmId, model, [tmId+model]',
      corpusTerms: 'id, corpusId',
      corpusPacks: 'id',
      versions: 'id, projectId, createdAt, [projectId+createdAt]',
    })
    // v6: document/block model (Milestone 2). `documents` is one row per
    // monolingual project; `blocks` carries source structure above the segments
    // ([documentId+index] drives ordered reads); `assets` holds embedded images
    // and the original file blob. The upgrade backfills existing projects from
    // each segment's `sourceMeta.blockIndex`.
    this.version(6)
      .stores({
        projects: 'id, name, updatedAt',
        projectTemplates: 'projectId',
        segments: 'id, projectId, index, status, [projectId+status], [projectId+index]',
        tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
        glossary: 'id, term, projectId',
        settings: '&key',
        embeddings: 'id, tmId, model, [tmId+model]',
        corpusTerms: 'id, corpusId',
        corpusPacks: 'id',
        versions: 'id, projectId, createdAt, [projectId+createdAt]',
        documents: 'id, projectId',
        blocks: 'id, documentId, projectId, [documentId+index]',
        assets: 'id, documentId, projectId',
      })
      .upgrade(migrateDocumentBlocks)

    // v7: personal term-bank + TM cloud sync (ROADMAP §3.4). Index `updatedAt`
    // on glossary/tm so the cursor-based reconciler can query rows changed since
    // its last sync, and add the `syncTombstones` table so deletes propagate.
    // The upgrade stamps a baseline `updatedAt` on existing rows so a signed-in
    // device pushes them on first reconcile.
    this.version(7)
      .stores({
        projects: 'id, name, updatedAt',
        projectTemplates: 'projectId',
        segments: 'id, projectId, index, status, [projectId+status], [projectId+index]',
        tm: 'id, source, sourceLang, targetLang, projectId, corpusId, updatedAt',
        glossary: 'id, term, projectId, updatedAt',
        settings: '&key',
        embeddings: 'id, tmId, model, [tmId+model]',
        corpusTerms: 'id, corpusId',
        corpusPacks: 'id',
        versions: 'id, projectId, createdAt, [projectId+createdAt]',
        documents: 'id, projectId',
        blocks: 'id, documentId, projectId, [documentId+index]',
        assets: 'id, documentId, projectId',
        syncTombstones: '[resource+rowId], resource, deletedAt',
      })
      .upgrade(backfillSyncTimestamps)
  }
}

/**
 * v7 upgrade: stamp a baseline `updatedAt` on existing glossary + personal TM
 * rows (skipping corpus-seeded TM, which never syncs) so the first cloud
 * reconcile has a timestamp to reason about. Uses a single `now` for the batch.
 */
export async function backfillSyncTimestamps(tx: Transaction): Promise<void> {
  const now = Date.now()
  const glossary = tx.table('glossary')
  const tm = tx.table('tm')
  await glossary.toCollection().modify((row: GlossaryEntry) => {
    if (row.updatedAt === undefined) row.updatedAt = now
  })
  await tm.toCollection().modify((row: TMEntry) => {
    if (row.updatedAt === undefined) row.updatedAt = now
  })
}

export const db = new VerbalisDB()

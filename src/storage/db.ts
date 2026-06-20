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

export interface SettingsRow<T = unknown> {
  key: string
  value: T
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
  }
}

export const db = new VerbalisDB()

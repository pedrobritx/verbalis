import Dexie, { type Table } from 'dexie'
import type { Project, Segment, TMEntry, GlossaryEntry, EmbeddingRecord } from '@/core/types'
import type { CorpusTerm, InstalledCorpusPack } from '@/core/corpus/types'

export interface SettingsRow<T = unknown> {
  key: string
  value: T
}

class VerbalisDB extends Dexie {
  projects!: Table<Project>
  segments!: Table<Segment>
  tm!: Table<TMEntry>
  glossary!: Table<GlossaryEntry>
  settings!: Table<SettingsRow>
  embeddings!: Table<EmbeddingRecord>
  corpusTerms!: Table<CorpusTerm>
  corpusPacks!: Table<InstalledCorpusPack>

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
  }
}

export const db = new VerbalisDB()

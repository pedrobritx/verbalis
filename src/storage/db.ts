import Dexie, { type Table } from 'dexie'
import type { Project, Segment, TMEntry, GlossaryEntry, EmbeddingRecord } from '@/core/types'

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
  }
}

export const db = new VerbalisDB()

import Dexie, { type Table } from 'dexie'
import type { Project, Segment, TMEntry, GlossaryEntry } from '@/core/types'

class VerbalisDB extends Dexie {
  projects!: Table<Project>
  segments!: Table<Segment>
  tm!: Table<TMEntry>
  glossary!: Table<GlossaryEntry>

  constructor() {
    super('verbalis')
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      segments: 'id, projectId, index, status',
      tm: 'id, source, sourceLang, targetLang, projectId',
      glossary: 'id, term, projectId',
    })
  }
}

export const db = new VerbalisDB()

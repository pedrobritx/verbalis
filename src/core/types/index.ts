export interface Project {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  createdAt: string
  updatedAt: string
}

export interface Segment {
  id: string
  projectId: string
  index: number
  source: string
  target: string
  status: 'untranslated' | 'draft' | 'translated' | 'reviewed' | 'locked'
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

export interface GlossaryEntry {
  id: string
  term: string
  definition: string
  translations: Record<string, string>
  notes?: string
  projectId?: string
}

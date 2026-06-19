// Bundled terminology corpora: pre-determined PT->EN legal/economic term packs
// that ship with Verbalis and can be installed by field/area into the glossary
// (and optionally seeded into the translation memory).

// One pack entry as stored in the static asset: [source, target, origin, note].
export type CorpusTermTuple = [string, string, string, string]

// Catalogue metadata for a single field pack (from manifest.json).
export interface CorpusPackMeta {
  id: string
  label: string
  description: string
  count: number
  // Provenance breakdown, e.g. { CADE: 2562, Noronha: 119 }.
  sources: Record<string, number>
  file: string
}

export interface CorpusManifest {
  version: number
  generatedAt: string
  langSource: string
  langTarget: string
  total: number
  packs: CorpusPackMeta[]
}

// The downloaded pack file under public/corpora/<id>.json.
export interface CorpusPackFile {
  id: string
  langSource: string
  langTarget: string
  terms: CorpusTermTuple[]
}

// A term row persisted in IndexedDB once a pack is installed.
export interface CorpusTerm {
  id: string
  // The field/pack this term belongs to (e.g. 'competition').
  corpusId: string
  source: string
  target: string
  sourceLang: string
  targetLang: string
  // Provenance tag carried from the termbase (CADE / Noronha / TIPS / …).
  origin: string
  note?: string
}

// Record of an installed pack, kept so the catalogue can show state and so a
// pack (and any TM entries it seeded) can be removed cleanly.
export interface InstalledCorpusPack {
  id: string
  label: string
  count: number
  sourceLang: string
  targetLang: string
  installedAt: string
  // Whether installing this pack also populated the translation memory.
  tmSeeded: boolean
}

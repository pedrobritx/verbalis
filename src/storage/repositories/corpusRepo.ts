import { db } from '@/storage/db'
import type {
  CorpusPackFile,
  CorpusPackMeta,
  CorpusTerm,
  InstalledCorpusPack,
} from '@/core/corpus/types'
import type { TMEntry } from '@/core/types'

export interface InstallPackOptions {
  // Also populate the translation memory with this pack's term pairs.
  seedTm?: boolean
}

function packToTerms(pack: CorpusPackFile): CorpusTerm[] {
  return pack.terms.map(([source, target, origin, note]) => ({
    id: crypto.randomUUID(),
    corpusId: pack.id,
    source,
    target,
    sourceLang: pack.langSource,
    targetLang: pack.langTarget,
    origin,
    note: note || undefined,
  }))
}

function termsToTm(terms: CorpusTerm[], corpusId: string): TMEntry[] {
  const date = new Date().toISOString()
  return terms.map((t) => ({
    id: crypto.randomUUID(),
    source: t.source,
    target: t.target,
    sourceLang: t.sourceLang,
    targetLang: t.targetLang,
    date,
    corpusId,
  }))
}

export const corpusRepo = {
  getAllPacks: (): Promise<InstalledCorpusPack[]> => db.corpusPacks.toArray(),
  getPack: (id: string) => db.corpusPacks.get(id),
  getAllTerms: (): Promise<CorpusTerm[]> => db.corpusTerms.toArray(),
  termsByCorpus: (corpusId: string) => db.corpusTerms.where({ corpusId }).toArray(),
  totalTermCount: (): Promise<number> => db.corpusTerms.count(),

  isInstalled: async (id: string): Promise<boolean> => (await db.corpusPacks.get(id)) !== undefined,

  // Install a downloaded pack: persist its terms, record install state, and
  // optionally seed the TM. Idempotent — re-installing replaces the pack.
  install: async (
    pack: CorpusPackFile,
    meta: Pick<CorpusPackMeta, 'label'>,
    opts: InstallPackOptions = {},
  ): Promise<void> => {
    await corpusRepo.uninstall(pack.id)
    const terms = packToTerms(pack)
    await db.corpusTerms.bulkAdd(terms)
    if (opts.seedTm) {
      await db.tm.bulkAdd(termsToTm(terms, pack.id))
    }
    const record: InstalledCorpusPack = {
      id: pack.id,
      label: meta.label,
      count: terms.length,
      sourceLang: pack.langSource,
      targetLang: pack.langTarget,
      installedAt: new Date().toISOString(),
      tmSeeded: Boolean(opts.seedTm),
    }
    await db.corpusPacks.put(record)
  },

  // Remove a pack: its terms, its install record, and any TM entries it seeded.
  uninstall: async (id: string): Promise<void> => {
    await db.corpusTerms.where({ corpusId: id }).delete()
    await db.tm.where({ corpusId: id }).delete()
    await db.corpusPacks.delete(id)
  },
}

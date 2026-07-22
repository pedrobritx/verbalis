import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { corpusRepo } from '@/storage/repositories/corpusRepo'
import type { CorpusPackFile } from '@/core/corpus/types'

function pack(over: Partial<CorpusPackFile> = {}): CorpusPackFile {
  return {
    id: 'competition',
    langSource: 'pt',
    langTarget: 'en',
    terms: [
      ['acórdão', 'appellate decision', 'CADE', ''],
      ['leniência', 'leniency', 'CADE', 'antitrust'],
    ],
    ...over,
  }
}

beforeEach(async () => {
  await db.corpusTerms.clear()
  await db.corpusPacks.clear()
  await db.tm.clear()
})

describe('corpusRepo', () => {
  it('installs a pack: terms + install record, no TM by default', async () => {
    await corpusRepo.install(pack(), { label: 'Competition & Antitrust' })

    const terms = await corpusRepo.termsByCorpus('competition')
    expect(terms).toHaveLength(2)
    expect(terms[0].corpusId).toBe('competition')
    expect(terms[0].sourceLang).toBe('pt')

    const record = await corpusRepo.getPack('competition')
    expect(record?.label).toBe('Competition & Antitrust')
    expect(record?.count).toBe(2)
    expect(record?.tmSeeded).toBe(false)

    expect(await db.tm.count()).toBe(0)
  })

  it('seeds the TM when requested, tagged with corpusId', async () => {
    await corpusRepo.install(pack(), { label: 'Competition' }, { seedTm: true })

    const tm = await db.tm.toArray()
    expect(tm).toHaveLength(2)
    expect(tm.every((e) => e.corpusId === 'competition')).toBe(true)
    expect(tm.find((e) => e.source === 'leniência')?.target).toBe('leniency')

    const record = await corpusRepo.getPack('competition')
    expect(record?.tmSeeded).toBe(true)
  })

  it('uninstall removes terms, record, and seeded TM entries', async () => {
    await corpusRepo.install(pack(), { label: 'Competition' }, { seedTm: true })
    await corpusRepo.uninstall('competition')

    expect(await corpusRepo.termsByCorpus('competition')).toHaveLength(0)
    expect(await corpusRepo.getPack('competition')).toBeUndefined()
    expect(await db.tm.count()).toBe(0)
  })

  it('re-installing replaces the previous pack (idempotent)', async () => {
    await corpusRepo.install(pack(), { label: 'Competition' })
    await corpusRepo.install(pack({ terms: [['multa', 'fine', 'CADE', '']] }), {
      label: 'Competition',
    })
    const terms = await corpusRepo.termsByCorpus('competition')
    expect(terms).toHaveLength(1)
    expect(terms[0].source).toBe('multa')
  })

  it('uninstall does not remove unrelated TM entries', async () => {
    await db.tm.add({
      id: crypto.randomUUID(),
      source: 'olá',
      target: 'hello',
      sourceLang: 'pt',
      targetLang: 'en',
      date: new Date().toISOString(),
    })
    await corpusRepo.install(pack(), { label: 'Competition' }, { seedTm: true })
    await corpusRepo.uninstall('competition')
    const remaining = await db.tm.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].source).toBe('olá')
  })
})

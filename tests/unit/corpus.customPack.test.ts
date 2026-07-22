import { describe, expect, it } from 'vitest'
import {
  rowsToCorpusFile,
  slugifyCorpusId,
  corpusTermsToGlossaryEntries,
} from '@/core/corpus/customPack'

describe('slugifyCorpusId', () => {
  it('namespaces and slugifies a name', () => {
    expect(slugifyCorpusId('Pharma EN→PT')).toBe('custom:pharma-en-pt')
    expect(slugifyCorpusId('  Legal/Tax  ')).toBe('custom:legal-tax')
  })
  it('falls back to a default slug for empty names', () => {
    expect(slugifyCorpusId('   ')).toBe('custom:corpus')
  })
})

describe('rowsToCorpusFile', () => {
  it('builds source→target tuples, picking the target language', () => {
    const file = rowsToCorpusFile(
      [
        { term: 'bank', translations: { pt: 'banco' }, notes: 'finance' },
        { term: 'court', translations: { pt: 'tribunal' }, notes: undefined },
      ],
      { id: 'custom:law', langSource: 'en', langTarget: 'pt' },
    )
    expect(file).toEqual({
      id: 'custom:law',
      langSource: 'en',
      langTarget: 'pt',
      terms: [
        ['bank', 'banco', 'custom', 'finance'],
        ['court', 'tribunal', 'custom', ''],
      ],
    })
  })

  it('matches the base language when the target is a regional variant', () => {
    const file = rowsToCorpusFile(
      [{ term: 'colour', translations: { 'en-GB': 'colour' }, notes: '' }],
      {
        id: 'custom:x',
        langSource: 'pt',
        langTarget: 'en-US',
      },
    )
    expect(file.terms).toEqual([['colour', 'colour', 'custom', '']])
  })

  it('drops rows with no usable translation', () => {
    const file = rowsToCorpusFile(
      [
        { term: 'orphan', translations: {}, notes: '' },
        { term: '', translations: { pt: 'x' }, notes: '' },
      ],
      { id: 'custom:x', langSource: 'en', langTarget: 'pt' },
    )
    expect(file.terms).toEqual([])
  })
})

describe('corpusTermsToGlossaryEntries', () => {
  it('adapts corpus terms to glossary-entry shape for export', () => {
    const entries = corpusTermsToGlossaryEntries([
      {
        id: 't1',
        corpusId: 'custom:x',
        source: 'bank',
        target: 'banco',
        sourceLang: 'en',
        targetLang: 'pt',
        origin: 'custom',
        note: 'n',
      },
    ])
    expect(entries).toEqual([
      { id: 't1', term: 'bank', definition: '', translations: { pt: 'banco' }, notes: 'n' },
    ])
  })
})

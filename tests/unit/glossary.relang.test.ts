import { describe, expect, it } from 'vitest'
import { relangEntry } from '@/core/glossary/relang'
import type { GlossaryEntry } from '@/core/types'

function entry(translations: Record<string, string>): GlossaryEntry {
  return { id: 'g1', term: 'bank', definition: '', translations }
}

describe('relangEntry', () => {
  it('re-files a single translation under the chosen language', () => {
    expect(relangEntry(entry({ es: 'banco' }), 'pt').translations).toEqual({ pt: 'banco' })
  })

  it('merges multiple languages into the chosen one, de-duplicated', () => {
    expect(relangEntry(entry({ es: 'banco', en: 'bank' }), 'pt').translations).toEqual({
      pt: 'banco; bank',
    })
  })

  it('preserves and de-duplicates multi-sense values', () => {
    expect(relangEntry(entry({ es: 'banco; orilla', fr: 'banco' }), 'pt').translations).toEqual({
      pt: 'banco; orilla',
    })
  })

  it('leaves an entry with no translations empty', () => {
    expect(relangEntry(entry({}), 'pt').translations).toEqual({})
  })

  it('keeps other fields intact', () => {
    const e = { ...entry({ es: 'banco' }), notes: 'finance', projectId: 'p1' }
    const out = relangEntry(e, 'pt')
    expect(out.term).toBe('bank')
    expect(out.notes).toBe('finance')
    expect(out.projectId).toBe('p1')
  })
})

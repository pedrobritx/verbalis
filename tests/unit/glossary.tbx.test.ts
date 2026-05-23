import { describe, expect, it } from 'vitest'
import { exportTBX, parseTBX } from '@/core/glossary/tbx'
import type { GlossaryEntry } from '@/core/types'

function entry(over: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    id: 'id-1',
    term: 'hello',
    definition: 'a greeting',
    translations: { es: 'hola', fr: 'bonjour' },
    notes: 'casual',
    ...over,
  }
}

describe('exportTBX', () => {
  it('emits a TBX-Basic document with martif root', () => {
    const xml = exportTBX([entry()], 'en')
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<martif type="TBX-Basic" xml:lang="en">')
    expect(xml).toContain('<termEntry id="id-1">')
    expect(xml).toContain('<descrip type="definition">a greeting</descrip>')
    expect(xml).toContain('<note>casual</note>')
  })

  it('emits one langSet for source and one per translation', () => {
    const xml = exportTBX([entry()], 'en')
    const langSets = xml.match(/<langSet xml:lang="[^"]+">/g) ?? []
    expect(langSets).toHaveLength(3)
    expect(xml).toContain('<langSet xml:lang="en">')
    expect(xml).toContain('<langSet xml:lang="es">')
    expect(xml).toContain('<langSet xml:lang="fr">')
  })

  it('escapes XML metacharacters', () => {
    const xml = exportTBX(
      [entry({ term: '<a> & "b"', definition: "c'd", translations: { es: 'x>y' } })],
      'en',
    )
    expect(xml).toContain('&lt;a&gt; &amp; &quot;b&quot;')
    expect(xml).toContain('c&apos;d')
    expect(xml).toContain('x&gt;y')
  })
})

describe('parseTBX', () => {
  it('parses a minimal document round-tripped from export', () => {
    const xml = exportTBX([entry()], 'en')
    const parsed = parseTBX(xml)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].term).toBe('hello')
    expect(parsed[0].definition).toBe('a greeting')
    expect(parsed[0].notes).toBe('casual')
    expect(parsed[0].translations).toEqual({ es: 'hola', fr: 'bonjour' })
  })

  it('skips termEntry without langSets', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<martif type="TBX-Basic" xml:lang="en">
  <text>
    <body>
      <termEntry id="empty"/>
      <termEntry id="good">
        <descrip type="definition">d</descrip>
        <langSet xml:lang="en"><tig><term>hi</term></tig></langSet>
        <langSet xml:lang="es"><tig><term>hola</term></tig></langSet>
      </termEntry>
    </body>
  </text>
</martif>`
    const parsed = parseTBX(xml)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].term).toBe('hi')
    expect(parsed[0].translations).toEqual({ es: 'hola' })
  })

  it('uses the explicit sourceLang argument when provided', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<martif type="TBX-Basic" xml:lang="fr">
  <text>
    <body>
      <termEntry>
        <langSet xml:lang="fr"><tig><term>bonjour</term></tig></langSet>
        <langSet xml:lang="en"><tig><term>hello</term></tig></langSet>
      </termEntry>
    </body>
  </text>
</martif>`
    const parsed = parseTBX(xml, 'fr')
    expect(parsed).toHaveLength(1)
    expect(parsed[0].term).toBe('bonjour')
    expect(parsed[0].translations).toEqual({ en: 'hello' })
  })

  it('throws on missing root element', () => {
    expect(() => parseTBX('<?xml version="1.0"?><other/>')).toThrow(/martif|tbx/i)
  })

  it('throws on malformed XML', () => {
    expect(() => parseTBX('<martif><text><body><termEntry></body>')).toThrow()
  })

  it('round-trips through export + parse', () => {
    const original: GlossaryEntry[] = [
      entry({ id: 'a', term: 'hello' }),
      entry({
        id: 'b',
        term: 'world',
        definition: 'planet',
        translations: { es: 'mundo' },
        notes: undefined,
      }),
    ]
    const xml = exportTBX(original, 'en')
    const parsed = parseTBX(xml)
    expect(parsed.map((p) => p.term)).toEqual(['hello', 'world'])
    expect(parsed[1].translations).toEqual({ es: 'mundo' })
  })
})

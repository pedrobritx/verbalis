import { describe, expect, it } from 'vitest'
import { exportTMX, parseTMX } from '@/core/tm/tmx'
import type { TMEntry } from '@/core/types'

function entry(over: Partial<TMEntry> = {}): TMEntry {
  return {
    id: 'id-1',
    source: 'Hello world',
    target: 'Hola mundo',
    sourceLang: 'en',
    targetLang: 'es',
    date: '2024-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('exportTMX', () => {
  it('emits a TMX 1.4 document', () => {
    const xml = exportTMX([entry()])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<tmx version="1.4">')
    expect(xml).toContain('creationtool="Verbalis"')
    expect(xml).toContain('segtype="sentence"')
  })

  it('escapes XML metacharacters', () => {
    const xml = exportTMX([entry({ source: '<a> & "b" \'c\'', target: 'x>y' })])
    expect(xml).toContain('&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos;')
    expect(xml).toContain('x&gt;y')
  })

  it('emits one <tu> per entry with both <tuv> children', () => {
    const xml = exportTMX([entry({ id: 'a' }), entry({ id: 'b', source: 'Goodbye' })])
    const tus = xml.match(/<tu[\s>]/g) ?? []
    const tuvs = xml.match(/<tuv\b/g) ?? []
    expect(tus).toHaveLength(2)
    expect(tuvs).toHaveLength(4)
  })
})

describe('parseTMX', () => {
  it('parses a minimal valid TMX', () => {
    const xml = exportTMX([entry()])
    const parsed = parseTMX(xml)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toEqual({
      source: 'Hello world',
      target: 'Hola mundo',
      sourceLang: 'en',
      targetLang: 'es',
    })
  })

  it('round-trips correctly through export + parse', () => {
    const entries = [
      entry({ id: 'a' }),
      entry({ id: 'b', source: 'How are you?', target: '¿Cómo estás?' }),
      entry({ id: 'c', source: 'Five & six > four', target: 'X' }),
    ]
    const xml = exportTMX(entries)
    const parsed = parseTMX(xml)
    expect(parsed.map((p) => p.source)).toEqual(entries.map((e) => e.source))
    expect(parsed.map((p) => p.target)).toEqual(entries.map((e) => e.target))
    expect(parsed.map((p) => p.sourceLang)).toEqual(entries.map((e) => e.sourceLang))
    expect(parsed.map((p) => p.targetLang)).toEqual(entries.map((e) => e.targetLang))
  })

  it('ignores unknown attributes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header creationtool="Other" segtype="sentence" srclang="en" datatype="plaintext"/>
  <body>
    <tu tuid="42" creationdate="20200101T000000Z" creationid="alice">
      <tuv xml:lang="en" foo="bar"><seg>Hello</seg></tuv>
      <tuv xml:lang="es"><seg>Hola</seg></tuv>
    </tu>
  </body>
</tmx>`
    const parsed = parseTMX(xml)
    expect(parsed).toEqual([
      { source: 'Hello', target: 'Hola', sourceLang: 'en', targetLang: 'es' },
    ])
  })

  it('skips tu elements without exactly two tuvs', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <body>
    <tu><tuv xml:lang="en"><seg>only one</seg></tuv></tu>
    <tu>
      <tuv xml:lang="en"><seg>a</seg></tuv>
      <tuv xml:lang="es"><seg>b</seg></tuv>
      <tuv xml:lang="fr"><seg>c</seg></tuv>
    </tu>
    <tu>
      <tuv xml:lang="en"><seg>good</seg></tuv>
      <tuv xml:lang="es"><seg>bueno</seg></tuv>
    </tu>
  </body>
</tmx>`
    const parsed = parseTMX(xml)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].source).toBe('good')
  })

  it('throws on missing <tmx> root', () => {
    expect(() => parseTMX('<?xml version="1.0"?><other><body/></other>')).toThrow(/tmx/i)
  })

  it('throws on malformed XML', () => {
    expect(() => parseTMX('<tmx><body><tu></body>')).toThrow()
  })
})

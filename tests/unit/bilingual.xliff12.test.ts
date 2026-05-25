import { describe, expect, it } from 'vitest'
import { exportXliff12, parseXliff12 } from '@/core/bilingual/xliff12'
import {
  statusToXliffState,
  xliffStateToStatus,
} from '@/core/bilingual/xliff12Status'
import type { ExportXliffUnit } from '@/core/bilingual/xliff12'

const MIN_XLIFF = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="es" datatype="plaintext" original="hello.txt">
    <body>
      <trans-unit id="1">
        <source>Hello world</source>
      </trans-unit>
      <trans-unit id="2" approved="yes">
        <source>Goodbye</source>
        <target state="final">Adiós</target>
      </trans-unit>
      <trans-unit id="3">
        <source>How are you?</source>
        <target state="needs-review-translation">¿Cómo estás?</target>
        <note>tone: casual</note>
      </trans-unit>
    </body>
  </file>
</xliff>`

describe('xliffStateToStatus', () => {
  it('maps known states', () => {
    expect(xliffStateToStatus('new', null)).toBe('untranslated')
    expect(xliffStateToStatus('needs-translation', null)).toBe('untranslated')
    expect(xliffStateToStatus('needs-review-translation', null)).toBe('draft')
    expect(xliffStateToStatus('translated', null)).toBe('translated')
    expect(xliffStateToStatus('signed-off', null)).toBe('reviewed')
    expect(xliffStateToStatus('final', null)).toBe('locked')
  })

  it('approved="yes" overrides to locked', () => {
    expect(xliffStateToStatus('translated', 'yes')).toBe('locked')
  })

  it('unknown states default to untranslated', () => {
    expect(xliffStateToStatus('mq-something', null)).toBe('untranslated')
    expect(xliffStateToStatus(undefined, undefined)).toBe('untranslated')
  })
})

describe('statusToXliffState', () => {
  it('round-trips each status', () => {
    for (const s of ['untranslated', 'draft', 'translated', 'reviewed', 'locked'] as const) {
      const { state, approved } = statusToXliffState(s)
      expect(xliffStateToStatus(state ?? null, approved ?? null)).toBe(s)
    }
  })
})

describe('parseXliff12', () => {
  it('reads file-level languages and original', () => {
    const parsed = parseXliff12(MIN_XLIFF)
    expect(parsed.sourceLang).toBe('en')
    expect(parsed.targetLang).toBe('es')
    expect(parsed.originalFile).toBe('hello.txt')
    expect(parsed.datatype).toBe('plaintext')
    expect(parsed.units).toHaveLength(3)
  })

  it('maps each trans-unit to a ParsedXliffUnit', () => {
    const parsed = parseXliff12(MIN_XLIFF)
    expect(parsed.units[0]).toMatchObject({
      transUnitId: '1',
      source: 'Hello world',
      target: '',
      status: 'untranslated',
    })
    expect(parsed.units[1]).toMatchObject({
      transUnitId: '2',
      source: 'Goodbye',
      target: 'Adiós',
      status: 'locked',
      rawState: 'final',
    })
    expect(parsed.units[2]).toMatchObject({
      transUnitId: '3',
      source: 'How are you?',
      target: '¿Cómo estás?',
      status: 'draft',
      note: 'tone: casual',
    })
  })

  it('throws when xliff root is missing', () => {
    expect(() => parseXliff12('<?xml version="1.0"?><other/>')).toThrow(/xliff/i)
  })

  it('throws when file-level languages are missing', () => {
    const xml = `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
      <file><body/></file>
    </xliff>`
    expect(() => parseXliff12(xml)).toThrow(/source-language/i)
  })
})

describe('exportXliff12 + parseXliff12 roundtrip', () => {
  it('reinjects targets and state into the original template', () => {
    const parsed = parseXliff12(MIN_XLIFF)
    const units: ExportXliffUnit[] = [
      { transUnitId: '1', target: 'Hola mundo', status: 'translated' },
      { transUnitId: '2', target: 'Adiós', status: 'locked' },
      { transUnitId: '3', target: '¿Cómo va?', status: 'reviewed' },
    ]
    const out = exportXliff12(parsed.templateXml, units)
    const reparsed = parseXliff12(out)

    const byId = Object.fromEntries(reparsed.units.map((u) => [u.transUnitId, u]))
    expect(byId['1'].target).toBe('Hola mundo')
    expect(byId['1'].status).toBe('translated')
    expect(byId['2'].target).toBe('Adiós')
    expect(byId['2'].status).toBe('locked')
    expect(byId['3'].target).toBe('¿Cómo va?')
    expect(byId['3'].status).toBe('reviewed')
  })

  it('creates a <target> element when the source had none', () => {
    const parsed = parseXliff12(MIN_XLIFF)
    const out = exportXliff12(parsed.templateXml, [
      { transUnitId: '1', target: 'Hola mundo', status: 'translated' },
    ])
    expect(out).toContain('Hola mundo')
    expect(out).toMatch(/<target[^>]*state="translated"[^>]*>Hola mundo<\/target>/)
  })

  it('preserves unrelated namespaces (memoQ mq:* survive roundtrip)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2" xmlns:mq="MQXliff">
  <file source-language="en" target-language="de" datatype="plaintext" original="a.docx" mq:doc-version="1">
    <body>
      <trans-unit id="42" mq:status="ConfirmedByReviewer">
        <source>Hi</source>
      </trans-unit>
    </body>
  </file>
</xliff>`
    const parsed = parseXliff12(xml)
    const out = exportXliff12(parsed.templateXml, [
      { transUnitId: '42', target: 'Hallo', status: 'translated' },
    ])
    expect(out).toContain('mq:doc-version="1"')
    expect(out).toContain('mq:status="ConfirmedByReviewer"')
    expect(out).toContain('Hallo')
  })
})

describe('inline tag preservation', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="es" datatype="html">
    <body>
      <trans-unit id="t1">
        <source>Click <g id="b1">here</g> to continue<x id="x1"/></source>
      </trans-unit>
    </body>
  </file>
</xliff>`

  it('collapses inline elements to numbered placeholders', () => {
    const parsed = parseXliff12(xml)
    const u = parsed.units[0]
    expect(u.source).toBe('Click {1} to continue{2}')
    expect(u.inlineTags?.['1']).toContain('<g')
    expect(u.inlineTags?.['1']).toContain('here')
    expect(u.inlineTags?.['2']).toContain('<x')
  })

  it('reinjects original tag XML on export when placeholders are kept', () => {
    const parsed = parseXliff12(xml)
    const u = parsed.units[0]
    const out = exportXliff12(parsed.templateXml, [
      {
        transUnitId: 't1',
        target: 'Pulsa {1} para continuar{2}',
        status: 'translated',
        inlineTags: u.inlineTags,
      },
    ])
    expect(out).toMatch(/<target[^>]*>Pulsa <g[^>]*>here<\/g> para continuar<x[^>]*\/?><\/target>/)
  })

  it('keeps unknown placeholders as literal text', () => {
    const parsed = parseXliff12(xml)
    const out = exportXliff12(parsed.templateXml, [
      {
        transUnitId: 't1',
        target: 'Foo {99} bar',
        status: 'translated',
        inlineTags: parsed.units[0].inlineTags,
      },
    ])
    expect(out).toContain('Foo {99} bar')
  })
})

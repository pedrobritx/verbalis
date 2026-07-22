import { describe, expect, it } from 'vitest'
import { createEditor, $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import {
  richStateToPlain,
  richStateToOriginal,
  RICH_NAMESPACE,
  getRichNodes,
} from '@/core/editor/richText'
// Importing the nodes registers them via registerRichNode (side effect), so the
// headless editors can parse states that contain inline tags and change marks.
import { $createInlineTagNode } from '@/features/editor/rich/InlineTagNode'
import { $createChangeMarkNode } from '@/features/editor/rich/ChangeMarkNode'
import { splitTextWithTags } from '@/core/bilingual/inlineTags'
import { parseXliff12, exportXliff12 } from '@/core/bilingual/xliff12'

function serializeWithText(text: string): string {
  const editor = createEditor({ namespace: RICH_NAMESPACE, onError: () => {} })
  editor.update(
    () => {
      const root = $getRoot()
      const paragraph = $createParagraphNode()
      paragraph.append($createTextNode(text))
      root.append(paragraph)
    },
    { discrete: true },
  )
  return JSON.stringify(editor.getEditorState().toJSON())
}

// Serialize placeholder-carrying text the way the editor seeds it: `{id}`
// placeholders become atomic InlineTagNodes, everything else stays text.
function serializeWithTags(text: string): string {
  const editor = createEditor({
    namespace: RICH_NAMESPACE,
    nodes: getRichNodes(),
    onError: () => {},
  })
  editor.update(
    () => {
      const root = $getRoot()
      const paragraph = $createParagraphNode()
      for (const part of splitTextWithTags(text)) {
        if (part.type === 'text') paragraph.append($createTextNode(part.value))
        else paragraph.append($createInlineTagNode(part.id))
      }
      root.append(paragraph)
    },
    { discrete: true },
  )
  return JSON.stringify(editor.getEditorState().toJSON())
}

describe('richStateToPlain', () => {
  it('round-trips plain text through a serialized Lexical state', () => {
    const json = serializeWithText('O Art. 5º garante direitos.')
    expect(richStateToPlain(json)).toBe('O Art. 5º garante direitos.')
  })

  it('returns empty string for missing input', () => {
    expect(richStateToPlain(undefined)).toBe('')
    expect(richStateToPlain('')).toBe('')
  })

  it('returns empty string for unparseable input rather than throwing', () => {
    expect(richStateToPlain('{ not valid lexical json')).toBe('')
  })

  // The inline-tag contract: a target with chips must derive to the exact same
  // `{id}` placeholder text that TM, QA, search and XLIFF export already consume.
  it('derives inline-tag nodes back to their {id} placeholders', () => {
    const json = serializeWithTags('Art. {1} do CDC {2}.')
    expect(richStateToPlain(json)).toBe('Art. {1} do CDC {2}.')
  })

  it('round-trips adjacent and repeated tags', () => {
    const json = serializeWithTags('{1}{2} e {1}')
    expect(richStateToPlain(json)).toBe('{1}{2} e {1}')
  })
})

// Tracked-changes derivation contract (ROADMAP §3 D2): the proposed plain text
// (what TM/QA/search/export consume) includes pending insertions and excludes
// pending deletions; the original text is the inverse. Non-change text projects
// identically under both.
describe('tracked-changes plain derivation', () => {
  // "Hello [+brave ]new [-old ]world" — one insertion, one deletion.
  function serializeWithChanges(): string {
    const editor = createEditor({
      namespace: RICH_NAMESPACE,
      nodes: getRichNodes(),
      onError: () => {},
    })
    editor.update(
      () => {
        const root = $getRoot()
        const p = $createParagraphNode()
        p.append($createTextNode('Hello '))
        const ins = $createChangeMarkNode({
          changeId: 'c1',
          changeType: 'insert',
          authorId: 'a',
          authorName: 'Ada',
          createdAt: 1,
        })
        ins.append($createTextNode('brave '))
        p.append(ins)
        p.append($createTextNode('new '))
        const del = $createChangeMarkNode({
          changeId: 'c2',
          changeType: 'delete',
          authorId: 'b',
          authorName: 'Bo',
          createdAt: 2,
        })
        del.append($createTextNode('old '))
        p.append(del)
        p.append($createTextNode('world'))
        root.append(p)
      },
      { discrete: true },
    )
    return JSON.stringify(editor.getEditorState().toJSON())
  }

  it('proposed text includes insertions and excludes deletions', () => {
    expect(richStateToPlain(serializeWithChanges())).toBe('Hello brave new world')
  })

  it('original text excludes insertions and includes deletions', () => {
    expect(richStateToOriginal(serializeWithChanges())).toBe('Hello new old world')
  })

  it('richStateToOriginal matches richStateToPlain when there are no changes', () => {
    const json = serializeWithText('O Art. 5º garante direitos.')
    expect(richStateToOriginal(json)).toBe(richStateToPlain(json))
  })

  it('returns empty string for missing or unparseable input', () => {
    expect(richStateToOriginal(undefined)).toBe('')
    expect(richStateToOriginal('{ not valid')).toBe('')
  })
})

// End-to-end data contract: an XLIFF unit with inline tags, imported → translated
// in the rich editor (tags as chips) → derived to plain → exported, must reinject
// the original tag XML in order. This is the chain the browser path exercises.
describe('inline tags: XLIFF import → rich edit → export', () => {
  const XLIFF = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="pt" datatype="plaintext" original="t.txt">
    <body>
      <trans-unit id="u1">
        <source>Click <g id="b1">here</g> to continue<x id="x1"/></source>
      </trans-unit>
    </body>
  </file>
</xliff>`

  it('preserves tag XML and order through the editor round-trip', () => {
    const parsed = parseXliff12(XLIFF)
    const unit = parsed.units[0]
    expect(unit.source).toBe('Click {1} to continue{2}')

    // Translator types the target keeping both placeholders; the rich editor
    // stores it as chips. Derive the plain text the way the editor does.
    const targetRich = serializeWithTags('Clique {1} para continuar{2}')
    const derivedPlain = richStateToPlain(targetRich)
    expect(derivedPlain).toBe('Clique {1} para continuar{2}')

    const out = exportXliff12(parsed.templateXml, [
      {
        transUnitId: unit.transUnitId,
        target: derivedPlain,
        status: 'translated',
        inlineTags: unit.inlineTags,
      },
    ])
    expect(out).toContain('<g id="b1">here</g>')
    expect(out).toContain('<x id="x1"/>')

    // Re-importing keeps the same two tags in the same positions. (Placeholder
    // numbers legitimately continue source→target on parse, so the target's
    // tags renumber; what must hold is that both tags survive in order.)
    const reparsed = parseXliff12(out)
    const target = reparsed.units[0].target
    expect(target).toMatch(/^Clique \{(\d+)\} para continuar\{(\d+)\}$/)
    const [, firstId, secondId] = target.match(/\{(\d+)\} para continuar\{(\d+)\}/)!
    expect(reparsed.units[0].inlineTags?.[firstId]).toContain('<g')
    expect(reparsed.units[0].inlineTags?.[secondId]).toContain('<x')
  })
})

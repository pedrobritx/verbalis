import { TAG_KIND_PRESENTATION, type InlineTagKind } from '@/core/bilingual/inlineTags'

// Presentational inline-tag chip, deliberately free of any Lexical import so the
// read-only source cell (SegmentRow) can render chips without pulling Lexical
// into the main bundle. The Lexical decorator node (InlineTagNode) renders this
// same chip from its `decorate()`.

interface InlineTagChipProps {
  id: string
  kind: InlineTagKind
  /** Render as a button (clickable to insert into the target). */
  onClick?: () => void
  title?: string
}

export function InlineTagChip({ id, kind, onClick, title }: InlineTagChipProps) {
  const { glyph, label } = TAG_KIND_PRESENTATION[kind]
  const titleText = title ?? `${label} ${id}`
  const content = (
    <>
      {glyph && (
        <span aria-hidden className="rsg-tag-glyph">
          {glyph}
        </span>
      )}
      <span className="rsg-tag-id">{id}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className="rsg-tag rsg-tag-button"
        data-tag-id={id}
        data-tag-kind={kind}
        title={titleText}
        aria-label={`Insert ${label} ${id}`}
        // Keep the editor selection/focus alive when inserting from a click.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <span
      className="rsg-tag"
      data-tag-id={id}
      data-tag-kind={kind}
      title={titleText}
      contentEditable={false}
    >
      {content}
    </span>
  )
}

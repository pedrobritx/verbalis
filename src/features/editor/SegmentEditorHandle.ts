/**
 * Thin interface the editor exposes per segment so the page can drive focus and
 * insertion without knowing whether the cell is a plain textarea or the Lexical
 * rich editor. Registered via `registerHandle` on each SegmentRow.
 */
export interface SegmentEditorHandle {
  /** Move keyboard focus into this segment's editor. */
  focus: () => void
  /** Insert text at the caret (used by glossary insert). */
  insertText: (text: string) => void
}

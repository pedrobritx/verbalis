import { parseDocxDocument } from '@/core/documents/docxImport'
import type { ParsedSegment } from './types'

/**
 * Segment a DOCX file. Delegates to the higher-fidelity document parser
 * (Phase 2.2) and returns just the flat `ParsedSegment[]`, so the segmentation
 * pipeline's contract is unchanged. The richer block/asset output is consumed
 * directly by the import flow via `parseDocxDocument`.
 */
export async function segmentDocx(arrayBuffer: ArrayBuffer): Promise<ParsedSegment[]> {
  const { segments } = await parseDocxDocument(arrayBuffer)
  return segments
}

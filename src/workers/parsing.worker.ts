import { expose } from 'comlink'
import { segmentText } from '@/core/segmentation'
import type { ParsedSegment } from '@/core/segmentation/types'

// Phase 1 note: this worker isn't wired into the import flow yet. sbd transitively
// pulls sanitize-html, which assumes a DOM at module load when bundled into a Web
// Worker. Phase 2 should either swap sentence splitters or shim sanitize-html.
// DOCX uses mammoth on the main thread and is intentionally not exposed here.
const api = {
  parse(content: string, type: 'txt' | 'md'): ParsedSegment[] {
    return segmentText(content, type)
  },
}

export type ParsingWorker = typeof api

expose(api)

import { expose } from 'comlink'
import { segment } from '@/core/segmentation'
import type { ParsedSegment, SourceType } from '@/core/segmentation/types'

// Phase 1 note: this worker isn't wired into the import flow yet. sbd transitively
// pulls sanitize-html, which assumes a DOM at module load when bundled into a Web
// Worker. Phase 2 should either swap sentence splitters or shim sanitize-html.
const api = {
  parse(content: string, type: SourceType): ParsedSegment[] {
    return segment(content, type)
  },
}

export type ParsingWorker = typeof api

expose(api)

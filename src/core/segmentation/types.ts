import type { SegmentSourceMeta } from '@/core/types'

export type SourceType = 'txt' | 'md' | 'docx'

export interface ParsedSegment {
  source: string
  sourceMeta: SegmentSourceMeta
}

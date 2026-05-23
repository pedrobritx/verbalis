import { segmentMd } from './md'
import { segmentTxt } from './txt'
import type { ParsedSegment, SourceType } from './types'

export type { ParsedSegment, SourceType } from './types'

export function detectType(filename: string): SourceType {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md'
  return 'txt'
}

export function segment(content: string, type: SourceType): ParsedSegment[] {
  return type === 'md' ? segmentMd(content) : segmentTxt(content)
}

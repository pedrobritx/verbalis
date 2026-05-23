import { segmentMd } from './md'
import { segmentTxt } from './txt'
import type { ParsedSegment, SourceType } from './types'

export type { ParsedSegment, SourceType } from './types'
export { segmentDocx } from './docx'

export function detectType(filename: string): SourceType {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md'
  if (lower.endsWith('.docx')) return 'docx'
  return 'txt'
}

export function segmentText(content: string, type: 'txt' | 'md'): ParsedSegment[] {
  return type === 'md' ? segmentMd(content) : segmentTxt(content)
}

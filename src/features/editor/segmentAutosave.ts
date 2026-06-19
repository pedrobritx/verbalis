import type { SegmentStatus } from '@/core/types'

/**
 * Status transitions shared by the plain and rich target editors so both behave
 * identically: typing into an untranslated segment makes it a draft; clearing a
 * draft returns it to untranslated. Any other status is left untouched.
 */
export function autosaveStatus(
  target: string,
  status: SegmentStatus,
): SegmentStatus | undefined {
  const trimmed = target.trim()
  if (status === 'untranslated' && trimmed.length > 0) return 'draft'
  if (status === 'draft' && trimmed.length === 0) return 'untranslated'
  return undefined
}

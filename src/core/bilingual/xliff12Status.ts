import type { SegmentStatus } from '@/core/types'

// XLIFF 1.2 trans-unit/target/@state values. The spec also allows
// arbitrary tool-specific values; preserve unknown ones via rawState.
export type Xliff12State =
  | 'new'
  | 'needs-translation'
  | 'needs-adaptation'
  | 'needs-l10n'
  | 'needs-review-translation'
  | 'needs-review-adaptation'
  | 'needs-review-l10n'
  | 'translated'
  | 'signed-off'
  | 'final'

export function xliffStateToStatus(
  state: string | null | undefined,
  approved: string | null | undefined,
): SegmentStatus {
  if (approved === 'yes') return 'locked'
  switch (state) {
    case 'final':
      return 'locked'
    case 'signed-off':
      return 'reviewed'
    case 'translated':
      return 'translated'
    case 'needs-review-translation':
    case 'needs-review-adaptation':
    case 'needs-review-l10n':
      return 'draft'
    case 'new':
    case 'needs-translation':
    case 'needs-adaptation':
    case 'needs-l10n':
    case null:
    case undefined:
    case '':
      return 'untranslated'
    default:
      return 'untranslated'
  }
}

export function statusToXliffState(status: SegmentStatus): {
  state?: Xliff12State
  approved?: 'yes'
} {
  switch (status) {
    case 'untranslated':
      return { state: 'needs-translation' }
    case 'draft':
      return { state: 'needs-review-translation' }
    case 'translated':
      return { state: 'translated' }
    case 'reviewed':
      return { state: 'signed-off' }
    case 'locked':
      return { state: 'final', approved: 'yes' }
  }
}

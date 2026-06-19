import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SegmentRow } from '@/features/editor/SegmentRow'
import type { Segment } from '@/core/types'

function segment(over: Partial<Segment> = {}): Segment {
  return {
    id: over.id ?? 'seg-1',
    projectId: 'p',
    index: over.index ?? 0,
    source: over.source ?? 'Hello world',
    target: over.target ?? '',
    status: over.status ?? 'untranslated',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

const rowProps = {
  isFocused: false,
  reviewMode: false,
  isBilingual: false,
  canJoinNext: false,
  richEditing: false,
  onConfirm: () => {},
  onToggleReviewed: () => {},
  onJoin: () => {},
  onMoveFocus: () => {},
  onFocus: () => {},
  registerHandle: () => {},
}

afterEach(cleanup)

describe('SegmentRow counter', () => {
  it('shows source word/char counts even with empty target', () => {
    render(<SegmentRow segment={segment({ source: 'Hello world' })} {...rowProps} />)
    expect(screen.getByText(/src 2w · 11c/i)).toBeInTheDocument()
  })

  it('flags an extreme expansion ratio with the warning color', () => {
    render(
      <SegmentRow
        segment={segment({
          source: 'Hi',
          target: 'Hello world, this is a much longer translation that pads',
          status: 'draft',
        })}
        {...rowProps}
      />,
    )
    const ratio = screen.getByText(/\d\.\d{2}×/)
    // Inline warning color is set when target is < 0.5× or > 2× source words.
    expect(ratio.getAttribute('style') ?? '').toMatch(/var\(--color-warning\)/)
  })
})

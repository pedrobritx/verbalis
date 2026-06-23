import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SegmentRow } from '@/features/editor/SegmentRow'
import type { Segment, SegmentStatus } from '@/core/types'

function makeSegment(status: SegmentStatus): Segment {
  return {
    id: 's1',
    projectId: 'p',
    index: 0,
    source: 'hello',
    target: 'olá',
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function renderRow(status: SegmentStatus, handlers: Partial<Record<string, () => void>>) {
  return render(
    <SegmentRow
      segment={makeSegment(status)}
      isFocused
      reviewMode={false}
      isBilingual={false}
      canJoinNext={false}
      richEditing={false}
      targetLang="pt"
      spellEnabled={false}
      onConfirm={handlers.onConfirm ?? vi.fn()}
      onUnconfirm={handlers.onUnconfirm ?? vi.fn()}
      onToggleReviewed={vi.fn()}
      onJoin={vi.fn()}
      onMoveFocus={vi.fn()}
      onFocus={vi.fn()}
      registerHandle={vi.fn()}
    />,
  )
}

describe('SegmentRow confirm toggle', () => {
  it('confirms a draft segment when the check is clicked', async () => {
    const onConfirm = vi.fn()
    const onUnconfirm = vi.fn()
    renderRow('draft', { onConfirm, onUnconfirm })
    fireEvent.click(screen.getByTestId('confirm-0'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onUnconfirm).not.toHaveBeenCalled()
  })

  it('un-confirms a translated segment when the check is clicked again', async () => {
    const onConfirm = vi.fn()
    const onUnconfirm = vi.fn()
    renderRow('translated', { onConfirm, onUnconfirm })
    const btn = screen.getByTestId('confirm-0')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn)
    await waitFor(() => expect(onUnconfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TMEditDialog } from '@/features/tm/TMEditDialog'
import type { TMEntry } from '@/core/types'

const entry: TMEntry = {
  id: 'tm1',
  source: 'hello',
  target: 'olá',
  sourceLang: 'en',
  targetLang: 'pt',
  date: '2026-01-01T00:00:00.000Z',
}

describe('TMEditDialog', () => {
  it('saves edited source/target and resolves project to undefined for global', async () => {
    const onSave = vi.fn()
    render(<TMEditDialog open entry={entry} projects={[]} onOpenChange={vi.fn()} onSave={onSave} />)

    const target = screen.getByTestId('tm-edit-target') as HTMLTextAreaElement
    expect(target.value).toBe('olá')
    fireEvent.change(target, { target: { value: 'oi' } })
    fireEvent.click(screen.getByTestId('tm-edit-save'))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith('tm1', {
        source: 'hello',
        target: 'oi',
        projectId: undefined,
      }),
    )
  })

  it('disables save when source or target is empty', () => {
    render(
      <TMEditDialog
        open
        entry={{ ...entry, target: '' }}
        projects={[]}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    )
    expect(screen.getByTestId('tm-edit-save')).toBeDisabled()
  })
})

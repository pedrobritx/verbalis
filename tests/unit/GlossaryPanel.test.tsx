import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/storage/db'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import { GlossaryPanel } from '@/features/editor/glossary/GlossaryPanel'
import { useAddTermStore } from '@/features/editor/glossary/useAddTermStore'

beforeEach(async () => {
  await db.glossary.clear()
  await db.settings.clear()
  useAddTermStore.setState({ open: false, initialTerm: '' })
})

describe('GlossaryPanel picker', () => {
  it('inserts a single chosen sense, not the whole multi-sense string', async () => {
    await glossaryRepo.create({
      id: 'g1',
      term: 'bank',
      definition: '',
      translations: { es: 'banco; orilla' },
      projectId: 'p',
    })
    const onInsert = vi.fn()

    render(
      <GlossaryPanel
        focusedSource="the river bank is steep"
        projectId="p"
        sourceLang="en"
        targetLang="es"
        onInsert={onInsert}
      />,
    )

    // Primary candidate is the first sense.
    const primary = await screen.findByTestId('glossary-insert-primary')
    fireEvent.click(primary)
    expect(onInsert).toHaveBeenCalledWith('banco')

    // The second sense is offered as its own candidate.
    const secondary = screen.getByTestId('glossary-insert-secondary')
    fireEvent.click(secondary)
    expect(onInsert).toHaveBeenCalledWith('orilla')
  })

  it('deletes a term after confirmation', async () => {
    await glossaryRepo.create({
      id: 'g2',
      term: 'court',
      definition: '',
      translations: { es: 'tribunal' },
      projectId: 'p',
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <GlossaryPanel
        focusedSource="the court ruled"
        projectId="p"
        sourceLang="en"
        targetLang="es"
        onInsert={vi.fn()}
      />,
    )

    fireEvent.click(await screen.findByTestId('glossary-delete-0'))
    await waitFor(async () => {
      expect(await glossaryRepo.getById('g2')).toBeUndefined()
    })
    confirmSpy.mockRestore()
  })

  it('opens the Add term dialog seeded with the selection', async () => {
    render(
      <GlossaryPanel
        focusedSource="hello world"
        projectId="p"
        sourceLang="en"
        targetLang="es"
        onInsert={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByTestId('glossary-add-term'))
    expect(useAddTermStore.getState().open).toBe(true)
  })
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/storage/db'
import ProjectsPage from '@/features/projects'
import { DeleteProjectDialog } from '@/features/projects/DeleteProjectDialog'
import { useProjectDialogsStore } from '@/features/projects/useProjectDialogsStore'
import type { Project, Segment } from '@/core/types'

function proj(id: string, name: string, overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString()
  return {
    id,
    name,
    sourceLang: 'en',
    targetLang: 'es',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function seg(projectId: string): Segment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    projectId,
    index: 0,
    source: 'src',
    target: '',
    status: 'untranslated',
    createdAt: now,
    updatedAt: now,
  }
}

beforeEach(async () => {
  await Promise.all([db.projects.clear(), db.segments.clear(), db.tm.clear(), db.glossary.clear()])
  useProjectDialogsStore.setState({ kind: null, projectId: null })
})

describe('ProjectsPage', () => {
  it('lists projects and filters by the search box', async () => {
    await db.projects.bulkAdd([proj('a', 'Alpha'), proj('b', 'Beta')])
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('project-search'), { target: { value: 'alph' } })
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).toBeNull()
  })

  it('opens the edit dialog from a card action', async () => {
    await db.projects.bulkAdd([proj('a', 'Alpha')])
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    )
    await screen.findByText('Alpha')
    fireEvent.click(screen.getByLabelText('Edit project'))
    expect(useProjectDialogsStore.getState().kind).toBe('edit')
    expect(useProjectDialogsStore.getState().projectId).toBe('a')
  })
})

describe('DeleteProjectDialog', () => {
  it('requires typing the project name and then cascades the delete', async () => {
    await db.projects.add(proj('a', 'Alpha'))
    await db.segments.bulkAdd([seg('a'), seg('a')])
    useProjectDialogsStore.setState({ kind: 'delete', projectId: 'a' })

    render(
      <MemoryRouter>
        <DeleteProjectDialog />
      </MemoryRouter>,
    )

    const confirm = await screen.findByTestId('delete-project-confirm')
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByTestId('delete-confirm-input'), { target: { value: 'Alpha' } })
    await waitFor(() => expect(confirm).not.toBeDisabled())

    fireEvent.click(confirm)
    await waitFor(async () => expect(await db.projects.get('a')).toBeUndefined())
    expect(await db.segments.where('projectId').equals('a').count()).toBe(0)
  })
})

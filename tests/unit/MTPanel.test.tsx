import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/storage/db'
import { MTPanel } from '@/features/editor/mt/MTPanel'
import {
  DEFAULT_MT_SETTINGS,
  MT_SETTINGS_KEY,
  settingsRepo,
} from '@/storage/repositories/settingsRepo'

beforeEach(async () => {
  await db.settings.clear()
  vi.restoreAllMocks()
})

function renderPanel(onApply = vi.fn()) {
  return render(
    <MemoryRouter>
      <MTPanel focusedSource="Hello world" sourceLang="en" targetLang="es" onApply={onApply} />
    </MemoryRouter>,
  )
}

describe('MTPanel', () => {
  it('renders empty state when no provider configured', async () => {
    renderPanel()
    expect(await screen.findByTestId('mt-empty')).toBeInTheDocument()
    expect(screen.getByTestId('mt-go-settings')).toBeInTheDocument()
  })

  it('translates and applies when a provider is enabled', async () => {
    await settingsRepo.set(MT_SETTINGS_KEY, {
      ...DEFAULT_MT_SETTINGS,
      default: 'libretranslate',
      libretranslate: {
        ...DEFAULT_MT_SETTINGS.libretranslate,
        enabled: true,
        endpoint: 'https://lt.example/translate',
      },
    })

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ translatedText: 'Hola mundo' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onApply = vi.fn()
    renderPanel(onApply)

    const button = await screen.findByTestId('mt-translate-button')
    fireEvent.click(button)

    const result = await screen.findByTestId('mt-result')
    expect(result).toHaveTextContent('Hola mundo')
    fireEvent.click(screen.getByTestId('mt-apply'))
    expect(onApply).toHaveBeenCalledWith('Hola mundo')
  })

  it('shows error message on provider failure', async () => {
    await settingsRepo.set(MT_SETTINGS_KEY, {
      ...DEFAULT_MT_SETTINGS,
      default: 'libretranslate',
      libretranslate: {
        ...DEFAULT_MT_SETTINGS.libretranslate,
        enabled: true,
        endpoint: 'https://lt.example/translate',
      },
    })

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPanel()

    const button = await screen.findByTestId('mt-translate-button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByTestId('mt-error')).toBeInTheDocument()
    })
  })
})

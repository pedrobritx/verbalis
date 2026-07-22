import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConnectorFilePicker } from '@/extensions/connectors/ConnectorFilePicker'
import type { ConnectorFile, StorageConnector } from '@/extensions/connectors/types'

function fakeConnector(files: ConnectorFile[]): StorageConnector {
  return {
    id: 'connector.gdrive',
    name: 'Google Drive',
    isConfigured: () => true,
    listFiles: vi.fn().mockResolvedValue(files),
    downloadFile: vi
      .fn()
      .mockImplementation(async (f: ConnectorFile) => new File(['data'], f.name)),
    uploadFile: vi.fn(),
  }
}

const FILES: ConnectorFile[] = [
  { id: '1', name: 'report.docx' },
  { id: '2', name: 'image.png' },
]

describe('ConnectorFilePicker (§6.3)', () => {
  it('lists accepted files and hides rejected ones', async () => {
    const connector = fakeConnector(FILES)
    render(
      <ConnectorFilePicker
        connector={connector}
        open
        onOpenChange={() => {}}
        accept={(f) => f.name.endsWith('.docx')}
        onPick={() => {}}
      />,
    )
    expect(await screen.findByTestId('connector-file-1')).toBeInTheDocument()
    expect(screen.queryByTestId('connector-file-2')).toBeNull()
    expect(connector.listFiles).toHaveBeenCalled()
  })

  it('downloads the picked file and calls onPick + closes', async () => {
    const connector = fakeConnector(FILES)
    const onPick = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConnectorFilePicker
        connector={connector}
        open
        onOpenChange={onOpenChange}
        onPick={onPick}
      />,
    )
    fireEvent.click(await screen.findByTestId('connector-file-1'))

    await waitFor(() => expect(onPick).toHaveBeenCalled())
    expect(connector.downloadFile).toHaveBeenCalledWith(FILES[0])
    const picked = onPick.mock.calls[0][0] as File
    expect(picked).toBeInstanceOf(File)
    expect(picked.name).toBe('report.docx')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('surfaces a listing error', async () => {
    const connector = fakeConnector(FILES)
    ;(connector.listFiles as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Authorisation cancelled'),
    )
    render(
      <ConnectorFilePicker connector={connector} open onOpenChange={() => {}} onPick={() => {}} />,
    )
    expect(await screen.findByTestId('connector-error')).toHaveTextContent(
      'Authorisation cancelled',
    )
  })
})

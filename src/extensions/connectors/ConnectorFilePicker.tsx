import { useEffect, useState } from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ConnectorFile, StorageConnector } from './types'

/**
 * Generic cloud-file picker (Phase 6.3). Provider-agnostic — it lists files
 * from any `StorageConnector`, filters to the acceptable ones, and calls
 * `onPick` with the downloaded `File`. Reused by every connector (Google Drive
 * now, OneDrive in 6.4) so import/export wiring is written once.
 */

interface ConnectorFilePickerProps {
  connector: StorageConnector
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Predicate limiting which listed files are selectable (e.g. by extension). */
  accept?: (file: ConnectorFile) => boolean
  /** Called with the downloaded file once the user picks one. */
  onPick: (file: File) => void
}

function messageFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg || 'Could not reach the cloud drive.'
}

export function ConnectorFilePicker({
  connector,
  open,
  onOpenChange,
  accept,
  onPick,
}: ConnectorFilePickerProps) {
  const [files, setFiles] = useState<ConnectorFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  async function load(q?: string) {
    setLoading(true)
    setError(null)
    try {
      const listed = await connector.listFiles(q ? { query: q } : undefined)
      setFiles(accept ? listed.filter(accept) : listed)
    } catch (err) {
      setError(messageFor(err))
      setFiles(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setQuery('')
      void load()
    } else {
      setFiles(null)
      setError(null)
      setDownloadingId(null)
    }
    // Load once per open; `connector` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function pick(file: ConnectorFile) {
    if (downloadingId) return
    setDownloadingId(file.id)
    setError(null)
    try {
      const downloaded = await connector.downloadFile(file)
      onPick(downloaded)
      onOpenChange(false)
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>{connector.name}</DialogTitle>
          <DialogDescription>Choose a file to import from {connector.name}.</DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void load(query)
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search files"
            data-testid="connector-search"
          />
          <Button type="submit" variant="plain" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </form>

        <div
          className="min-h-24 max-h-72 overflow-y-auto rounded-md border"
          style={{ borderColor: 'var(--color-border)' }}
          data-testid="connector-file-list"
        >
          {loading && (
            <p className="p-3 text-footnote" style={{ color: 'var(--color-muted)' }}>
              Loading…
            </p>
          )}
          {!loading && error && (
            <p
              className="p-3 text-footnote"
              style={{ color: 'var(--color-error)' }}
              data-testid="connector-error"
            >
              {error}
            </p>
          )}
          {!loading && !error && files && files.length === 0 && (
            <p className="p-3 text-footnote" style={{ color: 'var(--color-muted)' }}>
              No matching files found.
            </p>
          )}
          {!loading && !error && files && files.length > 0 && (
            <ul>
              {files.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => void pick(f)}
                    disabled={downloadingId !== null}
                    data-testid={`connector-file-${f.id}`}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-fill)] disabled:opacity-50"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <FileText
                      size={15}
                      className="shrink-0"
                      style={{ color: 'var(--color-muted)' }}
                    />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    {downloadingId === f.id && (
                      <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
                        Downloading…
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="plain" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

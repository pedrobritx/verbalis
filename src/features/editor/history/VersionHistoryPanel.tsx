import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { History, RotateCcw, Save, BadgeCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { versionRepo } from '@/storage/repositories/versionRepo'
import { useCanReview } from '../workflow/useWorkflowStore'
import { useLocalAuthor } from '../useLocalAuthor'
import { relativeTime } from './relativeTime'

interface VersionHistoryPanelProps {
  projectId: string
}

/**
 * Project version timeline (Foundation F2). Lists snapshots captured from the
 * project's Yjs doc — named "Save version" beats plus the throttled auto safety
 * net — newest first, and lets the translator roll the whole project back to any
 * of them. Restore routes through Dexie, so the editor updates reactively.
 */
export function VersionHistoryPanel({ projectId }: VersionHistoryPanelProps) {
  const versions = useLiveQuery(() => versionRepo.listByProject(projectId), [projectId])
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [signingOff, setSigningOff] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  // Sign-off is a review action — revisor / project_manager only (§5.3). A
  // local-only project resolves to PM-of-self, so it's always available there.
  const canReview = useCanReview()
  // Account-aware name (account name when signed in, else the device-local one)
  // so versions and sign-offs are attributed consistently across the app.
  const { authorName } = useLocalAuthor()

  async function handleSave() {
    setSaving(true)
    try {
      await versionRepo.saveNamed(projectId, label, undefined, authorName)
      setLabel('')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOff() {
    setSigningOff(true)
    try {
      await versionRepo.signOff(projectId, undefined, authorName)
    } finally {
      setSigningOff(false)
    }
  }

  async function handleRestore(id: string) {
    setRestoringId(id)
    try {
      await versionRepo.restoreProject(projectId, id)
    } finally {
      setRestoringId(null)
      setConfirmId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="version-history-panel">
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSave()
        }}
      >
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Version label (optional)"
          aria-label="Version label"
          data-testid="version-label-input"
          className="rounded-md border px-2 py-1.5 text-sm bg-transparent"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        />
        <div className="flex items-center gap-1.5">
          <Button
            type="submit"
            variant="tinted"
            size="sm"
            disabled={saving}
            data-testid="save-version"
            className="self-start"
          >
            <Save size={14} className="mr-1.5" />
            Save version
          </Button>
          {canReview && (
            <Button
              type="button"
              variant="bordered"
              size="sm"
              disabled={signingOff}
              onClick={() => void handleSignOff()}
              data-testid="sign-off"
              title="Record an approval milestone for the project"
              className="self-start"
              style={{ color: 'var(--color-accent)' }}
            >
              <BadgeCheck size={14} className="mr-1.5" />
              Sign off
            </Button>
          )}
        </div>
      </form>

      {!versions || versions.length === 0 ? (
        <div
          className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-3 py-6 text-center"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          <History size={18} />
          <p className="text-footnote">No versions yet. Save one to start a history.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5" data-testid="version-list">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-start justify-between gap-2 rounded-md border px-2.5 py-2"
              style={{
                borderColor: 'var(--color-border)',
                background: v.kind === 'named' ? 'var(--color-surface)' : 'transparent',
              }}
              data-testid="version-item"
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span
                  className="flex items-center gap-1 text-sm font-medium truncate"
                  style={{
                    color: v.approval
                      ? 'var(--color-accent)'
                      : v.kind === 'named'
                        ? 'var(--color-text)'
                        : 'var(--color-muted)',
                  }}
                  data-testid={v.approval ? 'version-approval' : undefined}
                >
                  {v.approval && <BadgeCheck size={13} className="shrink-0" />}
                  {v.label || (v.kind === 'auto' ? 'Auto-saved' : 'Untitled version')}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider tabular-nums"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {relativeTime(v.createdAt)}
                  {v.author ? ` · ${v.author}` : ''} · {v.segmentCount} seg
                </span>
              </div>
              {confirmId === v.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="tinted"
                    size="sm"
                    disabled={restoringId === v.id}
                    onClick={() => void handleRestore(v.id)}
                    data-testid="version-restore-confirm"
                  >
                    Confirm
                  </Button>
                  <Button variant="plain" size="sm" onClick={() => setConfirmId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(v.id)}
                  aria-label="Restore this version"
                  title="Restore this version"
                  data-testid="version-restore"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors hover:bg-[var(--color-fill)] shrink-0"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

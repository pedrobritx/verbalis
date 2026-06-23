import { Pencil, Trash2 } from 'lucide-react'
import type { TMEntry, Project } from '@/core/types'

interface TMTableProps {
  entries: TMEntry[]
  projectsById: Map<string, Project>
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onEdit: (entry: TMEntry) => void
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function TMTable({
  entries,
  projectsById,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
}: TMTableProps) {
  if (entries.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed p-10 text-center"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
      >
        <p className="text-sm">No TM entries match the current filters.</p>
      </div>
    )
  }

  const allSelected = entries.every((e) => selected.has(e.id))
  return (
    <table
      className="w-full text-sm border rounded-md"
      style={{ borderColor: 'var(--color-border)' }}
      data-testid="tm-table"
    >
      <thead>
        <tr style={{ color: 'var(--color-muted)' }}>
          <th className="w-8 p-2 text-left">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => onToggleAll(e.target.checked)}
              aria-label="Select all entries"
            />
          </th>
          <th className="p-2 text-left text-xs font-medium">Source</th>
          <th className="p-2 text-left text-xs font-medium">Target</th>
          <th className="p-2 text-left text-xs font-medium">Langs</th>
          <th className="p-2 text-left text-xs font-medium">Project</th>
          <th className="p-2 text-left text-xs font-medium">Date</th>
          <th className="w-16 p-2" />
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.id}
            data-testid="tm-row"
            data-tm-id={e.id}
            className="border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <td className="p-2 align-top">
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => onToggle(e.id)}
                aria-label="Select entry"
              />
            </td>
            <td className="p-2 align-top max-w-xs" style={{ color: 'var(--color-text)' }}>
              <div className="whitespace-pre-wrap break-words">{e.source}</div>
            </td>
            <td className="p-2 align-top max-w-xs" style={{ color: 'var(--color-text)' }}>
              <div className="whitespace-pre-wrap break-words">{e.target}</div>
            </td>
            <td className="p-2 align-top text-xs" style={{ color: 'var(--color-muted)' }}>
              {e.sourceLang} → {e.targetLang}
            </td>
            <td className="p-2 align-top text-xs" style={{ color: 'var(--color-muted)' }}>
              {e.projectId ? projectsById.get(e.projectId)?.name ?? '—' : '—'}
            </td>
            <td className="p-2 align-top text-xs" style={{ color: 'var(--color-muted)' }}>
              {formatDate(e.date)}
            </td>
            <td className="p-2 align-top">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(e)}
                  aria-label="Edit entry"
                  className="p-1 rounded transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                  data-testid="tm-edit-row"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onDelete(e.id)}
                  aria-label="Delete entry"
                  className="p-1 rounded transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                  data-testid="tm-delete-row"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

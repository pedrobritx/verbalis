import { Pencil, Trash2 } from 'lucide-react'
import type { GlossaryEntry, Project } from '@/core/types'

interface GlossaryTableProps {
  entries: GlossaryEntry[]
  projectsById: Map<string, Project>
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onEdit: (entry: GlossaryEntry) => void
  onDelete: (id: string) => void
}

export function GlossaryTable({
  entries,
  projectsById,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
}: GlossaryTableProps) {
  if (entries.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed p-10 text-center"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
      >
        <p className="text-sm">No glossary entries match the current filters.</p>
      </div>
    )
  }

  const allSelected = entries.every((e) => selected.has(e.id))
  return (
    <table
      className="w-full text-sm border rounded-md"
      style={{ borderColor: 'var(--color-border)' }}
      data-testid="glossary-table"
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
          <th className="p-2 text-left text-xs font-medium">Term</th>
          <th className="p-2 text-left text-xs font-medium">Definition</th>
          <th className="p-2 text-left text-xs font-medium">Translations</th>
          <th className="p-2 text-left text-xs font-medium">Project</th>
          <th className="p-2 text-left text-xs font-medium">Notes</th>
          <th className="w-20 p-2" />
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.id}
            data-testid="glossary-row"
            data-glossary-id={e.id}
            className="border-t align-top"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <td className="p-2">
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => onToggle(e.id)}
                aria-label="Select entry"
              />
            </td>
            <td className="p-2 font-medium" style={{ color: 'var(--color-text)' }}>
              <div className="whitespace-pre-wrap break-words">{e.term}</div>
            </td>
            <td className="p-2 max-w-xs text-xs" style={{ color: 'var(--color-muted)' }}>
              <div className="whitespace-pre-wrap break-words line-clamp-3">{e.definition}</div>
            </td>
            <td className="p-2">
              <div className="flex flex-wrap gap-1">
                {Object.entries(e.translations).map(([lang, value]) => (
                  <span
                    key={lang}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                    style={{
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    <span style={{ color: 'var(--color-muted)' }}>{lang}</span>
                    <span>{value}</span>
                  </span>
                ))}
              </div>
            </td>
            <td className="p-2 text-xs" style={{ color: 'var(--color-muted)' }}>
              {e.projectId ? (projectsById.get(e.projectId)?.name ?? '—') : '—'}
            </td>
            <td className="p-2 text-xs" style={{ color: 'var(--color-muted)' }}>
              <div className="whitespace-pre-wrap break-words line-clamp-2">{e.notes ?? ''}</div>
            </td>
            <td className="p-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(e)}
                  aria-label="Edit entry"
                  className="p-1 rounded transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                  data-testid="glossary-edit-row"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onDelete(e.id)}
                  aria-label="Delete entry"
                  className="p-1 rounded transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                  data-testid="glossary-delete-row"
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

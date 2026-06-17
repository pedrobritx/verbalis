import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useShortcutsStore } from './useShortcutsStore'

interface Shortcut {
  keys: string
  description: string
}
interface ShortcutGroup {
  heading: string
  items: Shortcut[]
}

const GROUPS: ShortcutGroup[] = [
  {
    heading: 'Global',
    items: [
      { keys: 'Ctrl K', description: 'Open command palette' },
      { keys: 'Ctrl L', description: 'Quick term lookup' },
      { keys: '?', description: 'Show this cheat-sheet' },
    ],
  },
  {
    heading: 'Editor',
    items: [
      { keys: 'Ctrl Enter', description: 'Confirm segment (mark translated, advance)' },
      { keys: 'Ctrl Shift Enter', description: 'Toggle reviewed' },
      { keys: 'Ctrl Shift R', description: 'Toggle review mode' },
      { keys: 'Ctrl H', description: 'Find & replace across project' },
      { keys: 'Ctrl E', description: 'Add selection to glossary' },
      { keys: 'Ctrl Shift K', description: 'Concordance search' },
      { keys: 'Alt ↓', description: 'Jump to next untranslated' },
      { keys: 'Alt Shift ↓', description: 'Jump to next draft' },
      { keys: '↑ / ↓', description: 'Previous / next segment' },
    ],
  },
  {
    heading: 'Sidebar tools (when focused)',
    items: [
      { keys: 'Ctrl 1…9', description: 'Apply TM match by number' },
      { keys: 'Ctrl Shift 1…5', description: 'Insert glossary term' },
    ],
  },
]

function KeyChip({ token }: { token: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[20px] h-6 px-1.5 rounded border text-[11px] font-mono"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-fill-secondary)',
        color: 'var(--color-text)',
      }}
    >
      {token}
    </kbd>
  )
}

function renderKeys(keys: string) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.split(' ').map((tok, i) => (
        <KeyChip key={i} token={tok} />
      ))}
    </span>
  )
}

export function ShortcutsDialog() {
  const open = useShortcutsStore((s) => s.open)
  const setOpen = useShortcutsStore((s) => s.setOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="shortcuts-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            On macOS, Ctrl maps to ⌘ (Command).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto pr-1">
          {GROUPS.map((g) => (
            <section key={g.heading} className="flex flex-col gap-2">
              <h3
                className="text-footnote uppercase tracking-wider font-semibold"
                style={{ color: 'var(--color-muted)' }}
              >
                {g.heading}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {g.items.map((s) => (
                  <li
                    key={s.keys}
                    className="flex items-center justify-between gap-3 py-1"
                  >
                    <span className="text-callout" style={{ color: 'var(--color-text)' }}>
                      {s.description}
                    </span>
                    {renderKeys(s.keys)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

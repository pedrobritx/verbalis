import { useSyncExternalStore } from 'react'
import { Puzzle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { extensionRegistry } from '@/core/extensions/registry'
import type {
  ExtensionKind,
  ExtensionManifest,
  ExtensionPermission,
} from '@/core/extensions/types'

/**
 * The Add-ons catalogue (ROADMAP §6.2). Lists everything pluggable — MT
 * providers, QA rules, and import/export formats — grouped by kind, with each
 * one's permissions and a built-in badge. MT providers and QA rules can be
 * enabled/disabled here (the registry drives the MT panel and QA output live);
 * formats are shown as built-in capabilities. Reads and writes the in-process
 * registry directly, so there is no backend and it works fully offline.
 */

const SECTIONS: { title: string; kinds: ExtensionKind[]; hint: string }[] = [
  {
    title: 'Machine translation',
    kinds: ['mt-provider'],
    hint: 'Providers offered in the MT panel. Disable one to hide it there.',
  },
  {
    title: 'Quality assurance',
    kinds: ['qa-rule'],
    hint: 'Checks run over your segments. Disabling one removes it from QA results.',
  },
  {
    title: 'Import & export formats',
    kinds: ['import-format', 'export-format'],
    hint: 'File formats Verbalis can read and write.',
  },
  {
    title: 'Storage connectors',
    kinds: ['storage-connector'],
    hint: 'Cloud drives to import from and save to. Disabling one hides its buttons.',
  },
]

/** Kinds the user can turn on/off here (their enablement is enforced elsewhere). */
const TOGGLEABLE_KINDS = new Set<ExtensionKind>(['mt-provider', 'qa-rule', 'storage-connector'])

const PERMISSION_LABEL: Record<ExtensionPermission, string> = {
  network: 'Network',
  credentials: 'API key',
  storage: 'Local data',
  clipboard: 'Clipboard',
  filesystem: 'Files',
}

function isToggleable(m: ExtensionManifest): boolean {
  return m.kinds.some((k) => TOGGLEABLE_KINDS.has(k))
}

export default function AddonsPage() {
  // Re-render on any enable/disable so toggles reflect the live registry.
  useSyncExternalStore(
    (cb) => extensionRegistry.subscribe(cb),
    () => extensionRegistry.getDisabledIds().join(','),
    () => '',
  )
  const all = extensionRegistry.list()

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto pb-8" data-testid="addons-page">
      <PageHeader title="Add-ons" subtitle="Built-in extensions — enable or disable what Verbalis offers" />

      {SECTIONS.map((section) => {
        const items = all.filter((m) => m.kinds.some((k) => section.kinds.includes(k)))
        if (items.length === 0) return null
        return (
          <section className="flex flex-col gap-3" key={section.title} data-testid={`addons-section-${section.kinds[0]}`}>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-callout font-semibold" style={{ color: 'var(--color-text)' }}>
                {section.title}
              </h2>
              <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
                {section.hint}
              </p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {items.map((m) => (
                <AddonRow key={m.id} manifest={m} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function AddonRow({ manifest }: { manifest: ExtensionManifest }) {
  const enabled = extensionRegistry.isEnabled(manifest.id)
  const toggleable = isToggleable(manifest)

  return (
    <li
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
        opacity: toggleable && !enabled ? 0.6 : 1,
      }}
      data-testid={`addon-${manifest.id}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Puzzle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {manifest.name}
            <span
              className="rounded-full border px-1.5 text-[10px] uppercase tracking-wider"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              {manifest.builtIn ? 'Built-in' : 'Installed'}
            </span>
          </span>
          {manifest.description && (
            <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
              {manifest.description}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-1 pt-0.5">
            {manifest.permissions.length === 0 ? (
              <PermissionChip label="No special access" />
            ) : (
              manifest.permissions.map((p) => <PermissionChip key={p} label={PERMISSION_LABEL[p]} />)
            )}
          </span>
        </div>
      </div>

      {toggleable ? (
        <label className="flex shrink-0 items-center gap-1.5 text-footnote" style={{ color: 'var(--color-muted)' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => extensionRegistry.setEnabled(manifest.id, e.target.checked)}
            data-testid={`addon-toggle-${manifest.id}`}
            aria-label={`${enabled ? 'Disable' : 'Enable'} ${manifest.name}`}
          />
          {enabled ? 'On' : 'Off'}
        </label>
      ) : (
        <span
          className="shrink-0 text-footnote"
          style={{ color: 'var(--color-muted)' }}
          data-testid={`addon-builtin-${manifest.id}`}
        >
          Always on
        </span>
      )}
    </li>
  )
}

function PermissionChip({ label }: { label: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px]"
      style={{ background: 'var(--color-fill)', color: 'var(--color-muted)' }}
    >
      {label}
    </span>
  )
}

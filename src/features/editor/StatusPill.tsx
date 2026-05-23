import type { SegmentStatus } from '@/core/types'

interface StatusPillProps {
  status: SegmentStatus
}

const STATUS_LABEL: Record<SegmentStatus, string> = {
  untranslated: 'untranslated',
  draft: 'draft',
  translated: 'translated',
  reviewed: 'reviewed',
  locked: 'locked',
}

const STATUS_COLOR: Record<SegmentStatus, string> = {
  untranslated: 'var(--color-muted)',
  draft: 'var(--color-warning)',
  translated: 'var(--color-confirm)',
  reviewed: 'var(--color-accent)',
  locked: 'var(--color-muted)',
}

export function StatusPill({ status }: StatusPillProps) {
  const color = STATUS_COLOR[status]
  return (
    <span
      data-testid="status-pill"
      data-status={status}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider"
      style={{ borderColor: color, color }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  )
}

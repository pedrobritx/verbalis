// Tracked-changes data model (revamp Milestone 1, ROADMAP §3 D1–D3).
//
// A tracked change is a pending suggestion recorded inline inside a segment's
// `targetRich` Lexical state as a `ChangeMarkNode`. There is deliberately no
// parallel store: the mark's attributes ARE the change, so versioning, restore,
// and Yjs mirroring need no cross-structure consistency logic. Panels read
// changes back out with the pure `extractChanges()` walker (see ./extract).

/**
 * The two kinds of pending change.
 * - `insert` — text a suggester added; counts toward the proposed plain text.
 * - `delete` — original text a suggester marked for removal; kept visible
 *   (strikethrough) but excluded from the proposed plain text (D2).
 */
export type ChangeType = 'insert' | 'delete'

/** Attribution + identity carried on every `ChangeMarkNode`. */
export interface TrackedChange {
  /** Stable id, unique within a segment; groups a run split across nodes. */
  id: string
  type: ChangeType
  /** Stable author id (from `profile.identity`), used for grouping/audit. */
  authorId: string
  /** Author display name at authoring time, used for colour + hover cards. */
  authorName: string
  /** Epoch millis when the change was first made. */
  createdAt: number
}

/** A short, collision-resistant id for a change run. */
export function createChangeId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `chg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import {
  createYdocPersistence,
  fetchSnapshot,
  fetchUpdates,
  claimCompaction,
} from '@/storage/cloud/ydocPersistence'
import { encodeBytea, decodeBytea } from '@/storage/cloud/bytea'

/**
 * In-memory stand-in for `ydoc_state` (one row per project) + the append-only
 * `ydoc_updates` log + the `claim_compaction` RPC, mirroring the exact PostgREST
 * chains the persistence loop uses, so catch-up / append / compaction are
 * exercised end-to-end without a real backend.
 */
function makeServer() {
  const state = new Map<string, { state: string | null; seq: number }>()
  const updates: { id: number; project_id: string; update: string }[] = []
  let idSeq = 1

  function ydocStateChain() {
    const filters: Record<string, unknown> = {}
    const b = {
      select() {
        return b
      },
      eq(col: string, val: unknown) {
        filters[col] = val
        return b
      },
      maybeSingle() {
        const row = state.get(filters.project_id as string) ?? null
        return Promise.resolve({ data: row, error: null })
      },
    }
    return b
  }

  function ydocUpdatesChain() {
    const filters: Record<string, unknown> = {}
    let countMode = false
    const rows = () => updates.filter((u) => u.project_id === filters.project_id)
    const b = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) {
        countMode = !!opts?.head
        return b
      },
      insert(row: { project_id: string; update: string }) {
        return {
          then(onF: (v: { error: null }) => unknown, onR?: () => unknown) {
            updates.push({ id: idSeq++, project_id: row.project_id, update: row.update })
            return Promise.resolve({ error: null }).then(onF, onR)
          },
        }
      },
      eq(col: string, val: unknown) {
        filters[col] = val
        return b
      },
      order() {
        const data = rows()
          .slice()
          .sort((a, z) => a.id - z.id)
          .map((u) => ({ id: u.id, update: u.update }))
        return Promise.resolve({ data, error: null })
      },
      then(onF: (v: { count: number; error: null }) => unknown, onR?: () => unknown) {
        // Terminal only for the head:true count query.
        const value = countMode
          ? { count: rows().length, error: null as null }
          : { count: 0, error: null as null }
        return Promise.resolve(value).then(onF, onR)
      },
    }
    return b
  }

  const client = {
    from(table: string) {
      if (table === 'ydoc_state') return ydocStateChain()
      if (table === 'ydoc_updates') return ydocUpdatesChain()
      throw new Error(`unexpected table ${table}`)
    },
    rpc(name: string, args: Record<string, unknown>) {
      if (name !== 'claim_compaction') throw new Error(`unexpected rpc ${name}`)
      const pid = args.p_project_id as string
      const row = state.get(pid)
      if (!row || row.seq !== args.p_expected_seq) {
        return Promise.resolve({ data: null, error: null })
      }
      row.state = args.p_state as string
      row.seq = (args.p_expected_seq as number) + 1
      const upTo = args.p_up_to_id as number
      for (let i = updates.length - 1; i >= 0; i--) {
        if (updates[i].project_id === pid && updates[i].id <= upTo) updates.splice(i, 1)
      }
      return Promise.resolve({ data: row.seq, error: null })
    },
  }

  return {
    client: client as unknown as SupabaseClient,
    updates,
    seed(projectId: string, bytes: Uint8Array | null, seq = 0) {
      state.set(projectId, { state: bytes ? encodeBytea(bytes) : null, seq })
    },
    snapshotBytes(projectId: string) {
      const s = state.get(projectId)?.state
      return s ? decodeBytea(s) : null
    },
    snapshotSeq(projectId: string) {
      return state.get(projectId)?.seq ?? 0
    },
  }
}

const PID = 'cloud-1'

/** A doc seeded from a snapshot, with a text key for content assertions. */
function docFrom(snapshot: Uint8Array | null): Y.Doc {
  const doc = new Y.Doc({ gc: true })
  if (snapshot) Y.applyUpdate(doc, snapshot)
  return doc
}
const text = (doc: Y.Doc) => doc.getText('t')

describe('catch-up', () => {
  it('converges a fresh doc from the cloud snapshot + append log', async () => {
    const server = makeServer()
    // Base snapshot: "Hello".
    const base = new Y.Doc()
    base.getText('t').insert(0, 'Hello')
    const snapshot = Y.encodeStateAsUpdate(base)
    server.seed(PID, snapshot)
    // Two further edits recorded only in the append log.
    let u1: Uint8Array | null = null
    base.on('update', (u) => (u1 = u))
    base.getText('t').insert(5, ' world')
    server.updates.push({ id: 1, project_id: PID, update: encodeBytea(u1!) })

    const doc = new Y.Doc({ gc: true })
    const p = createYdocPersistence({ client: server.client, cloudId: PID, doc })
    await p.catchUp()
    expect(text(doc).toString()).toBe('Hello world')
    p.destroy()
  })
})

describe('append', () => {
  it('coalesces a burst of local edits into one appended row', async () => {
    const server = makeServer()
    server.seed(PID, null)
    const doc = new Y.Doc({ gc: true })
    const p = createYdocPersistence({ client: server.client, cloudId: PID, doc })

    text(doc).insert(0, 'foo')
    text(doc).insert(3, 'bar')
    await p.flush()

    expect(server.updates).toHaveLength(1)
    const rebuilt = new Y.Doc()
    Y.applyUpdate(rebuilt, decodeBytea(server.updates[0].update))
    expect(text(rebuilt).toString()).toBe('foobar')
    p.destroy()
  })

  it('applied remote updates are never re-appended (ORIGIN_REMOTE)', async () => {
    const server = makeServer()
    const base = new Y.Doc()
    base.getText('t').insert(0, 'seed')
    server.seed(PID, Y.encodeStateAsUpdate(base))

    const doc = new Y.Doc({ gc: true })
    const p = createYdocPersistence({ client: server.client, cloudId: PID, doc })
    await p.catchUp() // applies the snapshot as ORIGIN_REMOTE
    await p.flush()
    expect(server.updates).toHaveLength(0) // nothing local to push
    p.destroy()
  })
})

describe('offline-A / online-B convergence (DoD)', () => {
  it('converges through Postgres on reconnect and never loses an edit', async () => {
    const server = makeServer()
    const base = new Y.Doc()
    base.getText('t').insert(0, 'X')
    const snapshot = Y.encodeStateAsUpdate(base)
    server.seed(PID, snapshot)

    const docA = docFrom(snapshot)
    const docB = docFrom(snapshot)
    const pA = createYdocPersistence({ client: server.client, cloudId: PID, doc: docA })
    const pB = createYdocPersistence({ client: server.client, cloudId: PID, doc: docB })
    await pA.catchUp()
    await pB.catchUp()

    // A edits while B is offline; A appends to Postgres.
    text(docA).insert(1, 'A1')
    await pA.flush()
    // B edits offline too (buffered, not yet flushed to the shared server).
    text(docB).insert(1, 'B1')

    // B reconnects: catch-up pulls A's edit and pushes B's offline edit.
    await pB.flush()
    await pB.catchUp()
    // A reconnects and catches up.
    await pA.catchUp()

    expect(text(docA).toString()).toBe(text(docB).toString())
    // Both edits survived (order is CRDT-deterministic but content is present).
    for (const s of ['A1', 'B1', 'X']) expect(text(docA).toString()).toContain(s)
    pA.destroy()
    pB.destroy()
  })
})

describe('compaction', () => {
  it('folds the log into a fresh snapshot and prunes it past the threshold', async () => {
    const server = makeServer()
    server.seed(PID, null)
    const doc = new Y.Doc({ gc: true })
    const p = createYdocPersistence({
      client: server.client,
      cloudId: PID,
      doc,
      compactThreshold: 2,
    })

    // Three flushed edits → three log rows; the third crosses the threshold and
    // triggers compaction, which folds them into the snapshot and prunes.
    text(doc).insert(0, 'a')
    await p.flush()
    text(doc).insert(1, 'b')
    await p.flush()
    text(doc).insert(2, 'c')
    await p.flush()

    expect(server.updates.length).toBeLessThanOrEqual(2)
    expect(server.snapshotSeq(PID)).toBe(1)
    // The compacted snapshot reproduces the full content.
    const fresh = docFrom(server.snapshotBytes(PID))
    // Replay any surviving updates on top.
    for (const u of server.updates) Y.applyUpdate(fresh, decodeBytea(u.update))
    expect(text(fresh).toString()).toBe('abc')
    p.destroy()
  })

  it('a stale optimistic claim loses the race (returns null)', async () => {
    const server = makeServer()
    server.seed(PID, new Uint8Array([0, 0]), 5)
    // A concurrent compactor already advanced seq to 6.
    const won = await claimCompaction(server.client, PID, 5, new Uint8Array([1]), 0)
    expect(won).toBe(6)
    // Our stale claim (still expecting 5) is rejected.
    const lost = await claimCompaction(server.client, PID, 5, new Uint8Array([2]), 0)
    expect(lost).toBeNull()
  })
})

describe('data helpers', () => {
  it('fetchSnapshot / fetchUpdates decode bytea round-trips', async () => {
    const server = makeServer()
    const bytes = new Uint8Array([1, 2, 250, 0, 42])
    server.seed(PID, bytes, 3)
    server.updates.push({ id: 7, project_id: PID, update: encodeBytea(new Uint8Array([9, 8])) })

    const snap = await fetchSnapshot(server.client, PID)
    expect(snap.seq).toBe(3)
    expect(snap.state).toEqual(bytes)

    const ups = await fetchUpdates(server.client, PID)
    expect(ups).toEqual([{ id: 7, bytes: new Uint8Array([9, 8]) }])
  })
})

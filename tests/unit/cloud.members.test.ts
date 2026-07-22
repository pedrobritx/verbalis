import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listMembers, inviteMember, changeMemberRole, removeMember } from '@/storage/cloud/members'

type Row = Record<string, unknown>
type Filter = ['eq', string, unknown] | ['in', string, unknown[]]

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((r) =>
    filters.every((f) =>
      f[0] === 'eq' ? r[f[1]] === f[2] : (f[2] as unknown[]).includes(r[f[1]]),
    ),
  )
}

/**
 * In-memory stand-in for the `project_members` + `profiles` tables and the
 * `invite_member` RPC, mirroring the exact PostgREST chains members.ts uses.
 * Optional hooks let a test force an error (an RLS denial or the ≥1-PM trigger).
 */
function makeClient(
  seed: { project_members?: Row[]; profiles?: Row[] } = {},
  hooks: {
    writeError?: string
    invite?: (args: Row) => { data: unknown; error: { message: string } | null }
  } = {},
) {
  const tables: Record<string, Row[]> = {
    project_members: seed.project_members ?? [],
    profiles: seed.profiles ?? [],
  }

  function terminal(result: () => { data?: unknown; error: unknown }) {
    return {
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(result()).then(onF, onR)
      },
    }
  }

  const client = {
    from(table: string) {
      return {
        select() {
          const filters: Filter[] = []
          const b = {
            eq(c: string, v: unknown) {
              filters.push(['eq', c, v])
              return b
            },
            in(c: string, v: unknown[]) {
              filters.push(['in', c, v])
              return b
            },
            ...terminal(() => ({ data: applyFilters(tables[table], filters), error: null })),
          }
          return b
        },
        update(patch: Row) {
          const filters: Filter[] = []
          const b = {
            eq(c: string, v: unknown) {
              filters.push(['eq', c, v])
              return b
            },
            ...terminal(() => {
              if (hooks.writeError) return { error: { message: hooks.writeError } }
              for (const r of applyFilters(tables[table], filters)) Object.assign(r, patch)
              return { error: null }
            }),
          }
          return b
        },
        delete() {
          const filters: Filter[] = []
          const b = {
            eq(c: string, v: unknown) {
              filters.push(['eq', c, v])
              return b
            },
            ...terminal(() => {
              if (hooks.writeError) return { error: { message: hooks.writeError } }
              const doomed = applyFilters(tables[table], filters)
              tables[table] = tables[table].filter((r) => !doomed.includes(r))
              return { error: null }
            }),
          }
          return b
        },
      }
    },
    rpc(name: string, args: Row) {
      if (name !== 'invite_member') throw new Error(`unexpected rpc ${name}`)
      if (hooks.invite) return Promise.resolve(hooks.invite(args))
      const email = String(args.p_email).trim().toLowerCase()
      const profile = tables.profiles.find((p) => String(p.email).toLowerCase() === email)
      if (!profile) return Promise.resolve({ data: null, error: null })
      const uid = profile.id as string
      const existing = tables.project_members.find(
        (m) => m.project_id === args.p_project_id && m.user_id === uid,
      )
      if (existing) existing.role = args.p_role
      else
        tables.project_members.push({
          project_id: args.p_project_id,
          user_id: uid,
          role: args.p_role,
        })
      return Promise.resolve({ data: uid, error: null })
    },
  }
  return { client: client as unknown as SupabaseClient, tables }
}

const PID = 'proj-1'

describe('listMembers', () => {
  it('joins the roster to profiles, marks self, and sorts managers first', async () => {
    const { client } = makeClient({
      project_members: [
        { project_id: PID, user_id: 'u2', role: 'translator' },
        { project_id: PID, user_id: 'u1', role: 'project_manager' },
      ],
      profiles: [
        { id: 'u1', display_name: 'Ana', email: 'ana@x.com' },
        { id: 'u2', display_name: 'Bo', email: 'bo@x.com' },
      ],
    })
    const members = await listMembers(client, PID, 'u2')
    expect(members.map((m) => [m.userId, m.role, m.isSelf])).toEqual([
      ['u1', 'project_manager', false],
      ['u2', 'translator', true],
    ])
    expect(members[0]).toMatchObject({ displayName: 'Ana', email: 'ana@x.com' })
  })

  it('returns an empty roster without querying profiles', async () => {
    const { client } = makeClient()
    expect(await listMembers(client, PID, 'u1')).toEqual([])
  })
})

describe('inviteMember', () => {
  it('invites an existing account and upserts the membership', async () => {
    const { client, tables } = makeClient({
      profiles: [{ id: 'u9', display_name: 'Cid', email: 'cid@x.com' }],
    })
    const res = await inviteMember(client, PID, 'Cid@x.com ', 'revisor')
    expect(res).toEqual({ status: 'invited', userId: 'u9' })
    expect(tables.project_members).toContainEqual({
      project_id: PID,
      user_id: 'u9',
      role: 'revisor',
    })
  })

  it('reports not_found when no account uses that email', async () => {
    const { client } = makeClient({ profiles: [] })
    expect(await inviteMember(client, PID, 'ghost@x.com', 'translator')).toEqual({
      status: 'not_found',
    })
  })

  it('propagates a forbidden error from the RPC', async () => {
    const { client } = makeClient(
      {},
      {
        invite: () => ({
          data: null,
          error: { message: 'only a project_manager may invite members' },
        }),
      },
    )
    await expect(inviteMember(client, PID, 'x@x.com', 'translator')).rejects.toThrow(
      /project_manager/,
    )
  })
})

describe('changeMemberRole / removeMember', () => {
  it('updates a member role in place', async () => {
    const { client, tables } = makeClient({
      project_members: [{ project_id: PID, user_id: 'u1', role: 'translator' }],
    })
    await changeMemberRole(client, PID, 'u1', 'revisor')
    expect(tables.project_members[0].role).toBe('revisor')
  })

  it('removes a member', async () => {
    const { client, tables } = makeClient({
      project_members: [
        { project_id: PID, user_id: 'u1', role: 'project_manager' },
        { project_id: PID, user_id: 'u2', role: 'translator' },
      ],
    })
    await removeMember(client, PID, 'u2')
    expect(tables.project_members.map((m) => m.user_id)).toEqual(['u1'])
  })

  it('surfaces the ≥1-manager trigger error as a thrown error', async () => {
    const { client } = makeClient(
      { project_members: [{ project_id: PID, user_id: 'u1', role: 'project_manager' }] },
      { writeError: 'a project must keep at least one project_manager' },
    )
    await expect(removeMember(client, PID, 'u1')).rejects.toThrow(/at least one project_manager/)
    await expect(changeMemberRole(client, PID, 'u1', 'translator')).rejects.toThrow(/at least one/)
  })
})

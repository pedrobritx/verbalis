import type { SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { db } from '@/storage/db'
import type { Project, ProjectRole, Segment, WorkflowStage } from '@/core/types'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { acquireProjectDoc, releaseProjectDoc } from '@/storage/sync/docManager'
import { readAllSegments } from '@/storage/sync/segmentCrdt'
import { useAuthStore } from '@/features/account/useAuthStore'
import { isCloudConfigured, getSupabase } from './supabaseClient'
import { encodeBytea, decodeBytea } from './bytea'

/**
 * Publish / open cloud projects (ROADMAP §4.1, D6/D8). Content lives as a Yjs
 * blob — the compacted `ydoc_state` snapshot (realtime append log arrives in
 * 4.2/4.3) — while Postgres holds the queryable `projects` row and `role`. The
 * pure data functions take an injected `SupabaseClient` so vitest never touches
 * a real backend; the orchestration wraps them with the local Yjs doc + Dexie.
 *
 * Strictly additive: nothing here loads until a signed-in user publishes or
 * opens (`getSupabase()` is dynamic), and Dexie stays the local source of truth.
 */

/** Lightweight cloud-project descriptor for the "open from cloud" list. */
export interface CloudProjectSummary {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  ownerId: string
}

interface ProjectRowSelect {
  id: string
  name: string
  source_lang: string
  target_lang: string
  owner_id: string
  stage?: WorkflowStage
  deadline?: string | null
}

function toSummary(r: ProjectRowSelect): CloudProjectSummary {
  return {
    id: r.id,
    name: r.name,
    sourceLang: r.source_lang,
    targetLang: r.target_lang,
    ownerId: r.owner_id,
  }
}

// ---------------------------------------------------------------------------
// Pure data layer (client injected)
// ---------------------------------------------------------------------------

/**
 * Seed the cloud from a local project: insert the `projects` row, the owner's
 * `project_manager` membership, and the compacted snapshot. Returns the new
 * cloud project id. RLS lets the owner insert all three (owner_id = auth.uid()).
 */
export async function insertCloudProject(
  client: SupabaseClient,
  input: {
    name: string
    sourceLang: string
    targetLang: string
    ownerId: string
    state: Uint8Array
  },
): Promise<string> {
  const { data, error } = await client
    .from('projects')
    .insert({
      name: input.name,
      source_lang: input.sourceLang,
      target_lang: input.targetLang,
      owner_id: input.ownerId,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const cloudId = (data as { id: string }).id

  const member = await client
    .from('project_members')
    .insert({ project_id: cloudId, user_id: input.ownerId, role: 'project_manager' })
  if (member.error) throw new Error(member.error.message)

  const snapshot = await client
    .from('ydoc_state')
    .insert({ project_id: cloudId, state: encodeBytea(input.state), seq: 0 })
  if (snapshot.error) throw new Error(snapshot.error.message)

  return cloudId
}

/** Cloud projects the signed-in user can see (member-scoped by RLS). */
export async function listCloudProjects(client: SupabaseClient): Promise<CloudProjectSummary[]> {
  const { data, error } = await client
    .from('projects')
    .select('id,name,source_lang,target_lang,owner_id')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as ProjectRowSelect[] | null) ?? []).map(toSummary)
}

/** One cloud project's metadata + this user's role, or null when not a member. */
export async function fetchCloudProject(
  client: SupabaseClient,
  cloudId: string,
  userId: string,
): Promise<{
  summary: CloudProjectSummary
  role: ProjectRole
  stage: WorkflowStage
  deadline: string | null
} | null> {
  const [projectRes, memberRes] = await Promise.all([
    client
      .from('projects')
      .select('id,name,source_lang,target_lang,owner_id,stage,deadline')
      .eq('id', cloudId)
      .maybeSingle(),
    client
      .from('project_members')
      .select('role')
      .eq('project_id', cloudId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  if (projectRes.error) throw new Error(projectRes.error.message)
  if (memberRes.error) throw new Error(memberRes.error.message)
  const row = projectRes.data as ProjectRowSelect | null
  if (!row) return null
  const role = (memberRes.data as { role: ProjectRole } | null)?.role ?? 'translator'
  return { summary: toSummary(row), role, stage: row.stage ?? 'translation', deadline: row.deadline ?? null }
}

/** Set a cloud project's workflow stage (project_manager-only, enforced by RLS). */
export async function setCloudProjectStage(
  client: SupabaseClient,
  cloudId: string,
  stage: WorkflowStage,
): Promise<void> {
  const { error } = await client.from('projects').update({ stage }).eq('id', cloudId)
  if (error) throw new Error(error.message)
}

/** The compacted Yjs snapshot for a cloud project, or null when unseeded. */
export async function fetchYdocState(
  client: SupabaseClient,
  cloudId: string,
): Promise<Uint8Array | null> {
  const { data, error } = await client
    .from('ydoc_state')
    .select('state')
    .eq('project_id', cloudId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const state = (data as { state: string } | null)?.state
  return state ? decodeBytea(state) : null
}

// ---------------------------------------------------------------------------
// Orchestration (local Yjs + Dexie)
// ---------------------------------------------------------------------------

function currentUserId(): string | null {
  const s = useAuthStore.getState()
  return s.status === 'authenticated' ? (s.user?.id ?? null) : null
}

/**
 * Publish a local project to the cloud. Encodes the project's live Yjs doc as
 * the seed snapshot (so pre-publish history is preserved), creates the cloud
 * rows, and stamps `project.cloud` locally. Idempotent: a project already linked
 * to the cloud returns its existing id. Returns null when the cloud is off.
 */
export async function publishProject(projectId: string): Promise<{ cloudId: string } | null> {
  if (!isCloudConfigured()) return null
  const userId = currentUserId()
  if (!userId) throw new Error('Sign in to publish a project to the cloud.')

  const project = await projectRepo.getById(projectId)
  if (!project) return null
  if (project.cloud) return { cloudId: project.cloud.id }

  const doc = await acquireProjectDoc(projectId)
  let state: Uint8Array
  try {
    state = Y.encodeStateAsUpdate(doc)
  } finally {
    releaseProjectDoc(projectId)
  }

  const client = await getSupabase()
  const cloudId = await insertCloudProject(client, {
    name: project.name,
    sourceLang: project.sourceLang,
    targetLang: project.targetLang,
    ownerId: userId,
    state,
  })
  await projectRepo.update(projectId, { cloud: { id: cloudId, role: 'project_manager' } })
  return { cloudId }
}

/**
 * Open a cloud project locally: hydrate a new Dexie project + its segments from
 * the cloud snapshot and link it via `project.cloud`. Returns the local project
 * id (an existing local copy is reused, never duplicated). Returns null when the
 * cloud is off or the user is not a member (RLS-denied).
 */
export async function openCloudProject(cloudId: string): Promise<string | null> {
  if (!isCloudConfigured()) return null
  const userId = currentUserId()
  if (!userId) throw new Error('Sign in to open a cloud project.')

  const existing = await db.projects.filter((p) => p.cloud?.id === cloudId).first()
  if (existing) return existing.id

  const client = await getSupabase()
  const meta = await fetchCloudProject(client, cloudId, userId)
  if (!meta) return null
  const state = await fetchYdocState(client, cloudId)

  const localId = crypto.randomUUID()
  const now = new Date().toISOString()
  const project: Project = {
    id: localId,
    name: meta.summary.name,
    sourceLang: meta.summary.sourceLang,
    targetLang: meta.summary.targetLang,
    createdAt: now,
    updatedAt: now,
    cloud: { id: cloudId, role: meta.role, stage: meta.stage, deadline: meta.deadline },
  }

  let segments: Segment[] = []
  if (state) {
    const doc = new Y.Doc({ gc: true })
    Y.applyUpdate(doc, state)
    segments = readAllSegments(doc, localId)
    doc.destroy()
  }

  await db.transaction('rw', [db.projects, db.segments], async () => {
    await db.projects.add(project)
    if (segments.length > 0) await db.segments.bulkAdd(segments)
  })
  return localId
}

/**
 * Advance a cloud project's workflow stage (project_manager-only, §5.2). Writes
 * Postgres — RLS rejects a non-PM — then patches the local `project.cloud.stage`
 * so the editor's role gating updates immediately. No-op / null when the cloud is
 * off or the project isn't cloud-linked.
 */
export async function changeProjectStage(
  projectId: string,
  stage: WorkflowStage,
): Promise<WorkflowStage | null> {
  if (!isCloudConfigured()) return null
  const project = await projectRepo.getById(projectId)
  if (!project?.cloud) return null

  const client = await getSupabase()
  await setCloudProjectStage(client, project.cloud.id, stage)
  await projectRepo.update(projectId, { cloud: { ...project.cloud, stage } })
  return stage
}

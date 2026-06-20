import * as Y from 'yjs'
import type { Segment, SegmentComment } from '@/core/types'

/**
 * The per-project Yjs document model (Foundation F2).
 *
 * A project's segment set is mirrored into a `Y.Doc` so that single-user version
 * history and (later, F3) multi-peer merge fall out of the same CRDT. For
 * single-user, Dexie stays the source of truth and this doc is a *derived*
 * mirror — every write into it is tagged {@link ORIGIN_DEXIE} so the future
 * Yjs→Dexie observer (F3) can ignore Dexie-originated changes and avoid loops.
 *
 * Layout:
 *   doc
 *    ├─ Y.Map "segments" : segmentId → Y.Map(segment fields)
 *    │     target   : Y.Text            (char-level CRDT; the merge-critical field)
 *    │     comments  : Y.Array<Y.Map>   (concurrent comment add/resolve merges)
 *    │     everything else: plain LWW values (index, source, status, locked,
 *    │                       note, targetRich, sourceMeta, bilingualMeta, *At)
 *    └─ Y.Map "meta"     : projectId, schemaVersion, seeded
 *
 * `sourceMeta`/`bilingualMeta` are mirrored as plain (JSON) values even though
 * they are immutable import artifacts: keeping them makes a restore lossless
 * (XLIFF round-trip survives) and lets a future peer export without Dexie.
 */

/** Transaction origin tag for every Dexie→Yjs mirror write. */
export const ORIGIN_DEXIE = 'dexie-mirror'

/**
 * Transaction origin tag for updates received from a remote peer (Foundation
 * F3). The reverse observer reconciles these into Dexie, and the sync session
 * skips re-broadcasting them, so a remote update never echoes back to its sender.
 */
export const ORIGIN_REMOTE = 'remote-peer'

/** Bumped if the doc layout changes in a non-backward-compatible way. */
export const SCHEMA_VERSION = 1

/** Plain scalar fields copied verbatim onto the segment Y.Map. */
const SCALAR_FIELDS = [
  'index',
  'source',
  'targetRich',
  'status',
  'locked',
  'note',
  'sourceMeta',
  'bilingualMeta',
  'createdAt',
  'updatedAt',
] as const

type ScalarField = (typeof SCALAR_FIELDS)[number]

type SegmentYMap = Y.Map<unknown>

export function getSegmentsMap(doc: Y.Doc): Y.Map<SegmentYMap> {
  return doc.getMap<SegmentYMap>('segments')
}

export function getMetaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('meta')
}

/** Whether this doc has been seeded from Dexie at least once. */
export function isSeeded(doc: Y.Doc): boolean {
  return getMetaMap(doc).get('seeded') === true
}

/** A plain deep clone, so Yjs only ever stores JSON-serializable values. */
function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T)
}

function commentToYMap(comment: SegmentComment): Y.Map<unknown> {
  const m = new Y.Map<unknown>()
  m.set('id', comment.id)
  m.set('body', comment.body)
  if (comment.author !== undefined) m.set('author', comment.author)
  m.set('createdAt', comment.createdAt)
  if (comment.resolved !== undefined) m.set('resolved', comment.resolved)
  return m
}

function yMapToComment(m: Y.Map<unknown>): SegmentComment {
  const comment: SegmentComment = {
    id: m.get('id') as string,
    body: (m.get('body') as string) ?? '',
    createdAt: (m.get('createdAt') as string) ?? '',
  }
  const author = m.get('author') as string | undefined
  if (author !== undefined) comment.author = author
  const resolved = m.get('resolved') as boolean | undefined
  if (resolved !== undefined) comment.resolved = resolved
  return comment
}

/** Build a fully-populated segment Y.Map and integrate it under `id`. */
function writeSegmentYMap(segments: Y.Map<SegmentYMap>, seg: Segment): void {
  const ymap = new Y.Map<unknown>()
  // Integrate the map first so its child Y.Text / Y.Array can be integrated too.
  segments.set(seg.id, ymap)

  for (const field of SCALAR_FIELDS) {
    const value = seg[field as keyof Segment]
    if (value !== undefined) ymap.set(field, clone(value))
  }

  const text = new Y.Text()
  ymap.set('target', text)
  if (seg.target) text.insert(0, seg.target)

  const comments = new Y.Array<Y.Map<unknown>>()
  ymap.set('comments', comments)
  if (seg.comments?.length) {
    comments.push(seg.comments.map(commentToYMap))
  }
}

/** Reconcile a comments Y.Array against the desired plain array, by id. */
function reconcileComments(
  yarr: Y.Array<Y.Map<unknown>>,
  comments: SegmentComment[] | undefined,
): void {
  const desired = comments ?? []
  const desiredIds = new Set(desired.map((c) => c.id))

  // Remove comments that no longer exist (back-to-front to keep indices valid).
  for (let i = yarr.length - 1; i >= 0; i -= 1) {
    const id = yarr.get(i).get('id') as string
    if (!desiredIds.has(id)) yarr.delete(i, 1)
  }

  const existing = new Map<string, Y.Map<unknown>>()
  for (let i = 0; i < yarr.length; i += 1) {
    const m = yarr.get(i)
    existing.set(m.get('id') as string, m)
  }

  desired.forEach((comment) => {
    const current = existing.get(comment.id)
    if (!current) {
      yarr.push([commentToYMap(comment)])
      return
    }
    if (current.get('body') !== comment.body) current.set('body', comment.body)
    if (current.get('author') !== comment.author) current.set('author', comment.author)
    if (current.get('resolved') !== comment.resolved) {
      current.set('resolved', comment.resolved)
    }
  })
}

/** Apply only the fields that differ, so the doc churns minimally. */
function patchSegmentYMap(ymap: SegmentYMap, seg: Segment): void {
  for (const field of SCALAR_FIELDS) {
    const next = seg[field as keyof Segment]
    const prev = ymap.get(field as ScalarField)
    // Compare scalars directly; objects (sourceMeta/bilingualMeta) by value.
    const changed =
      typeof next === 'object'
        ? JSON.stringify(next ?? null) !== JSON.stringify(prev ?? null)
        : next !== prev
    if (!changed) continue
    if (next === undefined) ymap.delete(field)
    else ymap.set(field, clone(next))
  }

  const text = ymap.get('target') as Y.Text | undefined
  const nextTarget = seg.target ?? ''
  if (text) {
    if (text.toString() !== nextTarget) {
      // Coarse replace is fine for the single-writer mirror; F3 can refine to a
      // character diff once a second writer exists.
      text.delete(0, text.length)
      if (nextTarget) text.insert(0, nextTarget)
    }
  } else {
    const fresh = new Y.Text()
    ymap.set('target', fresh)
    if (nextTarget) fresh.insert(0, nextTarget)
  }

  const comments = ymap.get('comments') as Y.Array<Y.Map<unknown>> | undefined
  if (comments) reconcileComments(comments, seg.comments)
}

/** Mirror a newly-created (or replacing) segment into the doc. */
export function applyCreate(doc: Y.Doc, seg: Segment): void {
  Y.transact(
    doc,
    () => {
      const segments = getSegmentsMap(doc)
      if (segments.has(seg.id)) {
        patchSegmentYMap(segments.get(seg.id)!, seg)
      } else {
        writeSegmentYMap(segments, seg)
      }
    },
    ORIGIN_DEXIE,
  )
}

/** Mirror an update. `seg` is the full next state of the row. */
export function applyUpdate(doc: Y.Doc, seg: Segment): void {
  Y.transact(
    doc,
    () => {
      const segments = getSegmentsMap(doc)
      const ymap = segments.get(seg.id)
      if (ymap) patchSegmentYMap(ymap, seg)
      else writeSegmentYMap(segments, seg)
    },
    ORIGIN_DEXIE,
  )
}

/** Mirror a deletion. */
export function applyDelete(doc: Y.Doc, id: string): void {
  Y.transact(
    doc,
    () => {
      getSegmentsMap(doc).delete(id)
    },
    ORIGIN_DEXIE,
  )
}

/** One-shot seed of an empty doc from the project's Dexie segments. */
export function seedFromDexie(doc: Y.Doc, projectId: string, segments: Segment[]): void {
  Y.transact(
    doc,
    () => {
      const meta = getMetaMap(doc)
      meta.set('projectId', projectId)
      meta.set('schemaVersion', SCHEMA_VERSION)
      const segMap = getSegmentsMap(doc)
      for (const seg of segments) {
        if (!segMap.has(seg.id)) writeSegmentYMap(segMap, seg)
      }
      meta.set('seeded', true)
    },
    ORIGIN_DEXIE,
  )
}

/** Read one segment back out of the doc as a plain Segment, or null. */
export function readSegment(doc: Y.Doc, projectId: string, id: string): Segment | null {
  const ymap = getSegmentsMap(doc).get(id)
  return ymap ? yMapToSegment(projectId, id, ymap) : null
}

/** Read every segment from the doc, ordered by `index`. */
export function readAllSegments(doc: Y.Doc, projectId: string): Segment[] {
  const segments: Segment[] = []
  getSegmentsMap(doc).forEach((ymap, id) => {
    segments.push(yMapToSegment(projectId, id, ymap))
  })
  segments.sort((a, b) => a.index - b.index)
  return segments
}

export function yMapToSegment(projectId: string, id: string, ymap: SegmentYMap): Segment {
  const text = ymap.get('target') as Y.Text | undefined
  const commentsArr = ymap.get('comments') as Y.Array<Y.Map<unknown>> | undefined
  const seg: Segment = {
    id,
    projectId,
    index: (ymap.get('index') as number) ?? 0,
    source: (ymap.get('source') as string) ?? '',
    target: text ? text.toString() : '',
    status: (ymap.get('status') as Segment['status']) ?? 'untranslated',
    createdAt: (ymap.get('createdAt') as string) ?? '',
    updatedAt: (ymap.get('updatedAt') as string) ?? '',
  }
  const targetRich = ymap.get('targetRich') as string | undefined
  if (targetRich !== undefined) seg.targetRich = targetRich
  const locked = ymap.get('locked') as boolean | undefined
  if (locked !== undefined) seg.locked = locked
  const note = ymap.get('note') as string | undefined
  if (note !== undefined) seg.note = note
  const sourceMeta = ymap.get('sourceMeta') as Segment['sourceMeta']
  if (sourceMeta !== undefined) seg.sourceMeta = clone(sourceMeta)
  const bilingualMeta = ymap.get('bilingualMeta') as Segment['bilingualMeta']
  if (bilingualMeta !== undefined) seg.bilingualMeta = clone(bilingualMeta)
  if (commentsArr && commentsArr.length > 0) {
    seg.comments = commentsArr.map(yMapToComment)
  }
  return seg
}

import 'fake-indexeddb/auto'
import * as Y from 'yjs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { versionRepo } from '@/storage/repositories/versionRepo'
import { installSegmentBridge, setDocResolver } from '@/storage/sync/bridge'
import {
  getProfileSettings,
  settingsRepo,
  PROFILE_SETTINGS_KEY,
} from '@/storage/repositories/settingsRepo'
import type { Segment } from '@/core/types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    projectId: 'p1',
    index: 0,
    source: 'src',
    target: '',
    status: 'untranslated',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

let doc: Y.Doc

beforeAll(() => {
  installSegmentBridge()
})

beforeEach(async () => {
  await db.segments.clear()
  await db.versions.clear()
  await settingsRepo.delete(PROFILE_SETTINGS_KEY)
  versionRepo.__resetThrottleForTest()
  doc = new Y.Doc()
  setDocResolver((projectId) => (projectId === 'p1' ? doc : null))
})

async function setAuthor(name: string) {
  await settingsRepo.set(PROFILE_SETTINGS_KEY, { displayName: name })
  // sanity: capture() reads the profile at version time
  expect((await getProfileSettings()).displayName).toBe(name)
}

describe('versionRepo.latestChanges', () => {
  it('reports a segment whose target changed, attributed to the saving author', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', index: 0, target: 'one' })])
    await setAuthor('Ana')
    await versionRepo.saveNamed('p1', 'v1', doc)
    await sleep(3)

    await segmentRepo.update('s1', { target: 'two' })
    await setAuthor('Bruno')
    await versionRepo.saveNamed('p1', 'v2', doc)

    const changes = await versionRepo.latestChanges('p1')
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      segmentId: 's1',
      index: 0,
      before: 'one',
      after: 'two',
      author: 'Bruno',
    })
  })

  it('ignores a segment that never changed (baseline only)', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', target: 'stable' })])
    await versionRepo.saveNamed('p1', 'v1', doc)
    await sleep(3)
    await versionRepo.saveNamed('p1', 'v2', doc)

    expect(await versionRepo.latestChanges('p1')).toEqual([])
  })

  it('keeps only the most recent change and orders by segment index', async () => {
    await segmentRepo.bulkCreate([
      makeSeg({ id: 'a', index: 1, target: 'a0' }),
      makeSeg({ id: 'b', index: 0, target: 'b0' }),
    ])
    await versionRepo.saveNamed('p1', 'v1', doc)
    await sleep(3)
    await segmentRepo.update('a', { target: 'a1' })
    await versionRepo.saveNamed('p1', 'v2', doc)
    await sleep(3)
    await segmentRepo.update('a', { target: 'a2' })
    await segmentRepo.update('b', { target: 'b1' })
    await versionRepo.saveNamed('p1', 'v3', doc)

    const changes = await versionRepo.latestChanges('p1')
    expect(changes.map((c) => c.index)).toEqual([0, 1]) // sorted by index
    const a = changes.find((c) => c.segmentId === 'a')!
    expect(a).toMatchObject({ before: 'a1', after: 'a2' }) // most recent change only
  })

  it('returns [] when there are no versions', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', target: 'x' })])
    expect(await versionRepo.latestChanges('p1')).toEqual([])
  })
})

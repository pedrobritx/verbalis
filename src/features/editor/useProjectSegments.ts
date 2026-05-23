import { useLiveQuery } from 'dexie-react-hooks'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import type { Segment } from '@/core/types'

export function useProjectSegments(projectId: string | undefined): Segment[] | undefined {
  return useLiveQuery<Segment[]>(
    () => (projectId ? segmentRepo.byProject(projectId) : Promise.resolve([] as Segment[])),
    [projectId],
  )
}

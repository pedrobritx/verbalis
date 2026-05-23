import { useLiveQuery } from 'dexie-react-hooks'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'

export function useGlossaryCache(projectId: string | undefined) {
  return useLiveQuery(
    () => (projectId ? glossaryRepo.byProjectOrGlobal(projectId) : glossaryRepo.getAll()),
    [projectId],
  )
}

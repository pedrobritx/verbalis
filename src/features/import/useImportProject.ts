import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { detectType, segment as segmentContent } from '@/core/segmentation'
import type { Segment } from '@/core/types'

export interface ImportProjectInput {
  file: File
  name: string
  sourceLang: string
  targetLang: string
}

export function useImportProject() {
  const navigate = useNavigate()
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importProject = useCallback(
    async ({ file, name, sourceLang, targetLang }: ImportProjectInput) => {
      setIsImporting(true)
      setError(null)
      try {
        const content = await file.text()
        const type = detectType(file.name)
        // Phase 1: segmentation runs on the main thread. Files are small (TXT/MD)
        // and the worker pipeline isn't worker-safe yet (sbd transitively pulls
        // sanitize-html which assumes a DOM at module load when bundled). Move
        // back into the worker in Phase 2 alongside search.
        const parsed = segmentContent(content, type)

        if (parsed.length === 0) {
          throw new Error('File produced no translatable segments.')
        }

        const projectId = crypto.randomUUID()
        const now = new Date().toISOString()

        await projectRepo.create({
          id: projectId,
          name,
          sourceLang,
          targetLang,
          createdAt: now,
          updatedAt: now,
        })

        const segments: Segment[] = parsed.map((p, i) => ({
          id: crypto.randomUUID(),
          projectId,
          index: i,
          source: p.source,
          target: '',
          status: 'untranslated',
          sourceMeta: p.sourceMeta,
          createdAt: now,
          updatedAt: now,
        }))

        await segmentRepo.bulkCreate(segments)
        navigate(`/project/${projectId}`)
        return projectId
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        setError(message)
        throw e
      } finally {
        setIsImporting(false)
      }
    },
    [navigate],
  )

  return { importProject, isImporting, error }
}

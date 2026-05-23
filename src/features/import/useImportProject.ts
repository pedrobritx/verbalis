import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { detectType, segmentText, segmentDocx } from '@/core/segmentation'
import type { ParsedSegment } from '@/core/segmentation'
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
        const type = detectType(file.name)
        // Segmentation runs on the main thread. TXT/MD files are small; DOCX uses
        // mammoth (also main-thread-only — see workers/parsing.worker.ts).
        let parsed: ParsedSegment[]
        if (type === 'docx') {
          const buffer = await file.arrayBuffer()
          parsed = await segmentDocx(buffer)
        } else {
          const content = await file.text()
          parsed = segmentText(content, type)
        }

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

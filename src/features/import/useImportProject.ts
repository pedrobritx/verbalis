import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { projectTemplateRepo } from '@/storage/repositories/projectTemplateRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { detectType, segmentText, segmentDocx } from '@/core/segmentation'
import type { ParsedSegment } from '@/core/segmentation'
import { parseXliff12 } from '@/core/bilingual/xliff12'
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
        const projectId = crypto.randomUUID()
        const now = new Date().toISOString()

        if (type === 'xliff') {
          const xml = await file.text()
          const parsed = parseXliff12(xml)
          if (parsed.units.length === 0) {
            throw new Error('XLIFF contains no <trans-unit> entries.')
          }

          await projectRepo.create({
            id: projectId,
            name,
            sourceLang: parsed.sourceLang,
            targetLang: parsed.targetLang,
            createdAt: now,
            updatedAt: now,
            bilingualMeta: {
              format: 'xliff12',
              originalFile: parsed.originalFile,
              datatype: parsed.datatype,
            },
          })
          // The template can be the entire source document; keep it out of the
          // project row so the projects list stays light.
          await projectTemplateRepo.put(projectId, parsed.templateXml)

          const segments: Segment[] = parsed.units.map((u, i) => ({
            id: crypto.randomUUID(),
            projectId,
            index: i,
            source: u.source,
            target: u.target,
            status: u.status,
            note: u.note,
            bilingualMeta: {
              transUnitId: u.transUnitId,
              rawState: u.rawState,
              inlineTags: u.inlineTags,
            },
            createdAt: now,
            updatedAt: now,
          }))

          await segmentRepo.bulkCreate(segments)
          navigate(`/project/${projectId}`)
          return projectId
        }

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

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { projectTemplateRepo } from '@/storage/repositories/projectTemplateRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { documentRepo, blockRepo, assetRepo } from '@/storage/repositories/documentRepo'
import { detectType, segmentText } from '@/core/segmentation'
import type { ParsedSegment } from '@/core/segmentation'
import { buildBlocksFromSegments } from '@/core/documents/fromSegments'
import { parseDocxDocument, type ParsedDocx } from '@/core/documents/docxImport'
import { parseXliff12 } from '@/core/bilingual/xliff12'
import type { Segment } from '@/core/types'
import type { Block, Asset } from '@/core/documents/model'

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
        // mammoth (also main-thread-only — see workers/parsing.worker.ts). DOCX
        // additionally yields a structured block tree (runs/tables/images).
        const documentId = crypto.randomUUID()
        let parsed: ParsedSegment[]
        let docx: ParsedDocx | null = null
        if (type === 'docx') {
          const buffer = await file.arrayBuffer()
          docx = await parseDocxDocument(buffer)
          parsed = docx.segments
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

        // Build the document/block model above the segments and link them up.
        let blocks: Block[]
        let assets: Asset[] = []
        if (docx) {
          // Preserve the DOCX-parsed blocks (with formatting runs / tables /
          // images), keyed by their block index; map each segment to its block.
          const blockIdByIndex = new Map<number, string>()
          blocks = docx.blocks.map((pb) => {
            const id = crypto.randomUUID()
            blockIdByIndex.set(pb.blockIndex, id)
            return {
              id,
              documentId,
              projectId,
              index: pb.blockIndex,
              kind: pb.kind,
              ...(pb.depth !== undefined ? { depth: pb.depth } : {}),
              ...(pb.ordered !== undefined ? { ordered: pb.ordered } : {}),
              ...(pb.sourceRuns ? { sourceRuns: pb.sourceRuns } : {}),
              ...(pb.attrs ? { attrs: pb.attrs } : {}),
            } satisfies Block
          })
          for (const seg of segments) {
            const bi = seg.sourceMeta?.blockIndex
            const blockId = bi !== undefined ? blockIdByIndex.get(bi) : undefined
            if (blockId) seg.blockId = blockId
          }
          assets = docx.assets.map((a) => ({
            id: a.id,
            documentId,
            projectId,
            kind: 'image' as const,
            mime: a.mime,
            blob: a.blob,
            name: a.name,
          }))
          // Keep the original .docx for future higher-fidelity re-processing.
          assets.push({
            id: crypto.randomUUID(),
            documentId,
            projectId,
            kind: 'original',
            mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            blob: file,
            name: file.name,
          })
        } else {
          const built = buildBlocksFromSegments(segments, { documentId, projectId })
          blocks = built.blocks
          for (const seg of segments) {
            const blockId = built.segmentBlockIds.get(seg.id)
            if (blockId) seg.blockId = blockId
          }
        }

        await documentRepo.create({
          id: documentId,
          projectId,
          name,
          sourceFormat: type,
          createdAt: now,
          updatedAt: now,
        })
        await blockRepo.bulkCreate(blocks)
        if (assets.length > 0) await assetRepo.bulkCreate(assets)
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

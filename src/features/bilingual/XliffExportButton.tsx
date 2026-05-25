import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportXliff12 } from '@/core/bilingual/xliff12'
import type { ExportXliffUnit } from '@/core/bilingual/xliff12'
import type { Project, Segment } from '@/core/types'

interface XliffExportButtonProps {
  project: Project
  segments: Segment[]
}

function buildFilename(project: Project): string {
  const original = project.bilingualMeta?.originalFile
  if (original) {
    const base = original.replace(/\.(xlf|xliff|mqxliff)$/i, '')
    return `${base}.${project.targetLang}.xlf`
  }
  const safe = project.name.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  return `${safe}.${project.targetLang}.xlf`
}

export function XliffExportButton({ project, segments }: XliffExportButtonProps) {
  const meta = project.bilingualMeta
  if (!meta || meta.format !== 'xliff12') return null

  function handleExport() {
    if (!meta || meta.format !== 'xliff12') return
    const units: ExportXliffUnit[] = []
    for (const seg of segments) {
      const id = seg.bilingualMeta?.transUnitId
      if (!id) continue
      units.push({
        transUnitId: id,
        target: seg.target,
        status: seg.status,
        inlineTags: seg.bilingualMeta?.inlineTags,
      })
    }
    const xml = exportXliff12(meta.templateXml, units)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = buildFilename(project)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      variant="bordered"
      onClick={handleExport}
      disabled={segments.length === 0}
      data-testid="xliff-export-button"
    >
      <Upload size={14} />
      Export XLIFF
    </Button>
  )
}

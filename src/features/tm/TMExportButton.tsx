import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportTMX } from '@/core/tm/tmx'
import type { TMEntry } from '@/core/types'

interface TMExportButtonProps {
  entries: TMEntry[]
}

function buildFilename(entries: TMEntry[]): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  if (entries.length === 0) return `verbalis-tm-${date}.tmx`
  const langs = new Set(entries.map((e) => `${e.sourceLang}-${e.targetLang}`))
  if (langs.size === 1) {
    const [pair] = langs
    return `verbalis-tm-${pair}-${date}.tmx`
  }
  return `verbalis-tm-${date}.tmx`
}

export function TMExportButton({ entries }: TMExportButtonProps) {
  function handleExport() {
    const xml = exportTMX(entries)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = buildFilename(entries)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      variant="bordered"
      onClick={handleExport}
      disabled={entries.length === 0}
      data-testid="tm-export-button"
    >
      <Upload />
      Export TMX
    </Button>
  )
}

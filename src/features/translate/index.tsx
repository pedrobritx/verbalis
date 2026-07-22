import { PageHeader } from '@/components/layout/PageHeader'
import { TranslateWorkspace } from './TranslateWorkspace'

export default function TranslatePage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader
        title="Translate"
        subtitle="Paste text, pick languages, translate — no project required."
      />
      <TranslateWorkspace active testIdPrefix="translate-page" autoFocus={false} />
    </div>
  )
}

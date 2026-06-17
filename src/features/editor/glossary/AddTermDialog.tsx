import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import { useAddTermStore } from './useAddTermStore'

interface AddTermDialogProps {
  projectId: string
  targetLang: string
}

export function AddTermDialog({ projectId, targetLang }: AddTermDialogProps) {
  const open = useAddTermStore((s) => s.open)
  const setOpen = useAddTermStore((s) => s.setOpen)
  const initialTerm = useAddTermStore((s) => s.initialTerm)

  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [global, setGlobal] = useState(false)

  useEffect(() => {
    if (open) {
      setTerm(initialTerm)
      setTranslation('')
      setGlobal(false)
    }
  }, [open, initialTerm])

  const save = async () => {
    const t = term.trim()
    if (!t) return
    await glossaryRepo.upsert({
      term: t,
      definition: '',
      translations: translation.trim() ? { [targetLang]: translation.trim() } : {},
      projectId: global ? undefined : projectId,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-md"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="add-term-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Add glossary term</DialogTitle>
          <DialogDescription>
            Capture a term so it is recognized and suggested in future segments.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-term-term">Term</Label>
            <Input
              id="add-term-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              data-testid="add-term-term"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-term-translation">Translation ({targetLang})</Label>
            <Input
              id="add-term-translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              data-testid="add-term-translation"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save()
              }}
            />
          </div>
          <label
            className="inline-flex items-center gap-1.5 text-footnote"
            style={{ color: 'var(--color-muted)' }}
          >
            <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} />
            Share across all projects (global)
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="bordered" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!term.trim()} data-testid="add-term-save">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { ImportDialog } from './ImportDialog'
import { useImportDialogStore } from './useImportDialogStore'

export function GlobalImportDialog() {
  const open = useImportDialogStore((s) => s.open)
  const setOpen = useImportDialogStore((s) => s.setOpen)
  return <ImportDialog open={open} onOpenChange={setOpen} />
}

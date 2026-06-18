import { EditProjectDialog } from './EditProjectDialog'
import { DeleteProjectDialog } from './DeleteProjectDialog'
import { DuplicateProjectDialog } from './DuplicateProjectDialog'

/** Mounts the project Edit / Delete / Duplicate dialogs once, app-wide. */
export function GlobalProjectDialogs() {
  return (
    <>
      <EditProjectDialog />
      <DeleteProjectDialog />
      <DuplicateProjectDialog />
    </>
  )
}

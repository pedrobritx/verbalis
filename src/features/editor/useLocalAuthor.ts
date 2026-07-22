import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ensureLocalAuthor,
  settingsRepo,
  PROFILE_SETTINGS_KEY,
  type LocalAuthor,
  type ProfileSettings,
} from '@/storage/repositories/settingsRepo'
import { useDisplayName } from '@/features/account/displayName'

// Mint/persist the stable author id once for the whole app, shared across every
// segment editor so we don't write it N times on load.
let authorIdOnce: Promise<LocalAuthor> | null = null
function loadAuthorOnce(): Promise<LocalAuthor> {
  return (authorIdOnce ??= ensureLocalAuthor())
}

/**
 * The local author used to attribute tracked changes: a stable id (minted and
 * persisted on first use) plus the current display name (reactive, so renaming
 * in Settings updates attribution on new changes immediately).
 */
export function useLocalAuthor(): LocalAuthor {
  const [authorId, setAuthorId] = useState('')
  const profile = useLiveQuery(
    () => settingsRepo.get<Partial<ProfileSettings>>(PROFILE_SETTINGS_KEY),
    [],
  )

  useEffect(() => {
    let alive = true
    void loadAuthorOnce().then((a) => {
      if (alive) setAuthorId(a.authorId)
    })
    return () => {
      alive = false
    }
  }, [])

  // Prefer the reactive stored id once available; fall back to the minted one.
  const id = profile?.authorId ?? authorId
  // When signed in, attribute to the account name automatically; else the
  // device-local name, else "You".
  const name = useDisplayName(profile?.displayName)
  return { authorId: id, authorName: name }
}

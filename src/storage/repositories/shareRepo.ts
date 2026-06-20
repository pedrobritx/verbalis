import { settingsRepo } from './settingsRepo'

/**
 * Per-project LAN-sharing preference (Foundation F3).
 *
 * Sharing is opt-in: a project stays private until the user turns it on. The
 * flag (and an optional passphrase for the encrypted LAN transport) lives in the
 * existing key/value `settings` table — additive, no Dexie migration — keyed by
 * project id, mirroring how MT and editor prefs are stored.
 */
export interface ShareSettings {
  /** Whether this project participates in peer sync. */
  shared: boolean
  /** Shared secret for the encrypted LAN transport (desktop peers). */
  passphrase?: string
}

export const DEFAULT_SHARE_SETTINGS: ShareSettings = { shared: false }

const shareKey = (projectId: string) => `sync.share.${projectId}`

export const shareRepo = {
  get: async (projectId: string): Promise<ShareSettings> => {
    const stored = await settingsRepo.get<ShareSettings>(shareKey(projectId))
    return stored ? { ...DEFAULT_SHARE_SETTINGS, ...stored } : { ...DEFAULT_SHARE_SETTINGS }
  },
  set: (projectId: string, settings: ShareSettings): Promise<unknown> =>
    settingsRepo.set(shareKey(projectId), settings),
}

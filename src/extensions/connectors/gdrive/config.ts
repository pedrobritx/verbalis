import { extensionRegistry } from '@/core/extensions/registry'

/**
 * Lightweight Google Drive connector config + availability gate (Phase 6.3).
 *
 * Kept free of GIS / REST imports so UI can decide whether to *offer* the Drive
 * affordances without pulling the connector's heavy code into the initial graph
 * — the connector module (`./index`) is dynamically imported only when the user
 * actually clicks "From cloud" / "Save to Drive".
 */

/** Manifest id for the Google Drive storage-connector addon. */
export const CONNECTOR_GDRIVE_ID = 'connector.gdrive'

/** The Google OAuth client id, if configured at build time. */
export function googleClientId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return id && id.trim() ? id.trim() : undefined
}

/** True when the connector has the client id it needs to run. */
export function isGdriveConfigured(): boolean {
  return googleClientId() !== undefined
}

/**
 * True when Drive is both configured *and* enabled in the Add-ons registry.
 * The import/export affordances gate on this; disabling the addon hides them.
 * Unregistered ⇒ treated as enabled (registry default), so config alone gates
 * before the built-ins are registered.
 */
export function isGdriveAvailable(): boolean {
  if (!isGdriveConfigured()) return false
  return (
    !extensionRegistry.has(CONNECTOR_GDRIVE_ID) || extensionRegistry.isEnabled(CONNECTOR_GDRIVE_ID)
  )
}

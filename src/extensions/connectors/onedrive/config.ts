import { extensionRegistry } from '@/core/extensions/registry'

/**
 * Lightweight OneDrive connector config + availability gate (Phase 6.4).
 *
 * Mirrors the Google Drive `config.ts`: kept free of MSAL / Graph imports so UI
 * can decide whether to *offer* OneDrive without pulling the connector's heavy
 * code (`@azure/msal-browser` + the Graph layer) into the initial graph — those
 * load only when the user actually clicks a OneDrive affordance.
 */

/** Manifest id for the OneDrive storage-connector addon. */
export const CONNECTOR_ONEDRIVE_ID = 'connector.onedrive'

/** The Microsoft (Azure AD) app client id, if configured at build time. */
export function msalClientId(): string | undefined {
  const id = import.meta.env.VITE_MS_CLIENT_ID
  return id && id.trim() ? id.trim() : undefined
}

/** True when the connector has the client id it needs to run. */
export function isOnedriveConfigured(): boolean {
  return msalClientId() !== undefined
}

/**
 * True when OneDrive is both configured *and* enabled in the Add-ons registry.
 * The import/export affordances gate on this; disabling the addon hides them.
 * Unregistered ⇒ treated as enabled (registry default), so config alone gates
 * before the built-ins are registered.
 */
export function isOnedriveAvailable(): boolean {
  if (!isOnedriveConfigured()) return false
  return !extensionRegistry.has(CONNECTOR_ONEDRIVE_ID) || extensionRegistry.isEnabled(CONNECTOR_ONEDRIVE_ID)
}

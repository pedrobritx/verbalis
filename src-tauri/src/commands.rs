//! Tauri commands bridging the React app to the LAN transport (Foundation F3).
//!
//! These are the exact commands `TauriLanTransport`
//! (`src/storage/sync/transport/tauri.ts`) invokes. Inbound peer messages are
//! delivered back to the webview via the `verbalis://sync/<projectId>` event.
//!
//! Status: scaffold. Signatures and wiring are in place so the JS transport
//! compiles against a real contract; the discovery + socket loops they will
//! drive are the follow-up.

use crate::mdns;
use crate::transport::{SyncMessage, SyncState};
use tauri::State;

/// Begin sharing a project: advertise via mDNS and accept peer connections.
#[tauri::command]
pub fn start_sharing(project_id: String, state: State<'_, SyncState>) -> Result<(), String> {
    let mut projects = state.projects.lock().map_err(|e| e.to_string())?;
    projects.entry(project_id.clone()).or_default();
    // Advertise on an OS-assigned port (0 → ephemeral) for now.
    let _daemon = mdns::start(&format!("verbalis-{project_id}"), 0).map_err(|e| e.to_string())?;
    Ok(())
}

/// Stop sharing a project: drop peers and unregister the mDNS service.
#[tauri::command]
pub fn stop_sharing(project_id: String, state: State<'_, SyncState>) -> Result<(), String> {
    let mut projects = state.projects.lock().map_err(|e| e.to_string())?;
    projects.remove(&project_id);
    Ok(())
}

/// Send a `SyncMessage` to every connected peer of a project.
#[tauri::command]
pub fn broadcast_sync_message(
    project_id: String,
    message: SyncMessage,
    state: State<'_, SyncState>,
) -> Result<(), String> {
    let projects = state.projects.lock().map_err(|e| e.to_string())?;
    if let Some(_peers) = projects.get(&project_id) {
        // Follow-up: write `message` to each peer socket. Payloads are already
        // encrypted by the JS codec, so this layer only frames + ships bytes.
        let _ = &message;
    }
    Ok(())
}

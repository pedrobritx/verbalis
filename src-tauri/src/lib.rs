//! Verbalis desktop shell (Foundation F3).
//!
//! The shell is deliberately thin: it adds only what a browser cannot do —
//! mDNS discovery of peers on the LAN and an encrypted socket to exchange Yjs
//! updates. Everything else (the entire CAT tool) is the shared React app loaded
//! from `../dist`. The JS side talks to this shell through the commands in
//! [`commands`], and receives inbound peer messages via the
//! `verbalis://sync/<projectId>` event — the exact contract the
//! `TauriLanTransport` in `src/storage/sync/transport/tauri.ts` expects.

mod commands;
mod mdns;
mod transport;

use transport::SyncState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SyncState::default())
        .invoke_handler(tauri::generate_handler![
            commands::start_sharing,
            commands::stop_sharing,
            commands::broadcast_sync_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Verbalis desktop shell");
}

//! Encrypted LAN transport for peer sync (Foundation F3).
//!
//! Carries the same `SyncMessage` shapes as the browser BroadcastChannel
//! transport (`src/storage/sync/transport/types.ts`) between mDNS-discovered
//! peers ([`crate::mdns`]). Payloads are already end-to-end encrypted by the JS
//! AES-GCM codec before they reach this layer, so the socket only moves opaque
//! bytes — the shell never sees plaintext segment content.
//!
//! Status: scaffold. The per-project peer set and TCP framing are modelled here;
//! the accept/connect loops are the follow-up's work.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

/// Mirrors the JS `SyncMessage` discriminated union (kind + optional payload).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SyncMessage {
    Hello { from: String },
    Bye { from: String },
    StateRequest { from: String },
    State { from: String, payload: Vec<u8> },
    Update { from: String, payload: Vec<u8> },
    Presence { from: String, payload: Vec<u8> },
}

/// A peer we are connected to for a given project.
#[derive(Default)]
pub struct ProjectPeers {
    /// instance name → resolved socket address.
    pub addrs: HashMap<String, String>,
}

/// Shared, Tauri-managed sync state: which projects are shared and their peers.
#[derive(Default)]
pub struct SyncState {
    pub projects: Mutex<HashMap<String, ProjectPeers>>,
}

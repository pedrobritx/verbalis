//! mDNS / zeroconf peer discovery (Foundation F3).
//!
//! Every desktop peer advertises a `_verbalis._tcp.local` service and browses
//! for the same, so peers find each other with zero configuration — memoQ's
//! "server URL" box becomes "peers found on your network". The discovered
//! address + port is where [`crate::transport`] opens the encrypted sync socket.
//!
//! Status: scaffold. The advertise/browse loop is sketched against `mdns-sd`;
//! wiring it to the transport and surfacing peers to the webview lands in the
//! follow-up that builds the desktop pipeline end-to-end.

use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;

pub const SERVICE_TYPE: &str = "_verbalis._tcp.local.";

/// A peer discovered on the local network.
#[derive(Clone, Debug)]
pub struct Peer {
    pub instance: String,
    pub host: String,
    pub port: u16,
}

/// Advertise this peer and start browsing for others.
///
/// Returns the daemon so the caller can keep it alive for the session; dropping
/// it unregisters the service.
pub fn start(instance_name: &str, port: u16) -> mdns_sd::Result<ServiceDaemon> {
    let daemon = ServiceDaemon::new()?;

    let host_name = format!("{instance_name}.local.");
    let properties: HashMap<String, String> = HashMap::new();
    let service = ServiceInfo::new(
        SERVICE_TYPE,
        instance_name,
        &host_name,
        "", // let mdns-sd resolve local addresses
        port,
        properties,
    )?;
    daemon.register(service)?;

    // Browsing yields add/remove events the transport layer consumes to open or
    // close peer connections. (Event loop wiring: follow-up.)
    let _receiver = daemon.browse(SERVICE_TYPE)?;

    Ok(daemon)
}

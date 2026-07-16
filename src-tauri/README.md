# Verbalis desktop shell (Tauri) — Foundation F3

This is the **thin desktop peer** for Verbalis. It exists for one reason a browser
cannot satisfy: **LAN collaboration**. Browsers can't bind sockets or do mDNS; a
Tauri shell can, while reusing 100% of the existing React app.

> Design rule (roadmap §9.3): *all product logic stays in the shared React app;
> the desktop shell stays thin — discovery + transport only.* Nothing in `src/`
> here knows about segments, TM, or the UI. It moves opaque, already-encrypted
> bytes between peers.

## What's here

| File | Role |
|---|---|
| `src/mdns.rs` | Advertise + browse `_verbalis._tcp.local` peers (zero-config). |
| `src/transport.rs` | Encrypted LAN socket carrying the JS `SyncMessage`s. |
| `src/commands.rs` | `start_sharing` / `stop_sharing` / `broadcast_sync_message`. |
| `src/lib.rs` | Tauri builder; registers commands + shared sync state. |

The JS side talks to this shell through `src/storage/sync/transport/tauri.ts`,
which `createTransport()` selects automatically when `isTauri()` is true. Inbound
peer messages are delivered to the webview via the `verbalis://sync/<projectId>`
event. The same `SyncMessage` shapes flow over the browser BroadcastChannel
transport, so the sync engine above the transport is identical on both platforms.

## Status

**Scaffold.** The TypeScript sync core (bidirectional CRDT, presence, sharing UI,
encryption codec) is complete and tested in the PWA today via the BroadcastChannel
transport. This Rust shell wires the contract end-to-end; the mDNS browse loop and
the TCP accept/connect loops are completed in the follow-up that builds the desktop
release pipeline.

## Not part of the PWA CI

The web app ships as a static PWA to GitHub Pages and its CI never compiles Rust.
The desktop build is a **separate pipeline** (a second toolchain — see roadmap
§9.3) and is intentionally excluded from `pnpm build` / `vite build`.

## Run locally

```bash
# one-time: install the Rust toolchain + Tauri CLI
rustup default stable
pnpm add -D @tauri-apps/cli @tauri-apps/api   # if not already installed

pnpm tauri:dev      # dev: loads http://localhost:5173/
pnpm tauri:build    # production bundle (runs `pnpm build` first)
```

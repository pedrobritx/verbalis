# Verbalis cloud setup

Verbalis runs **100% local by default** — no account, no server, everything in
IndexedDB. The optional **signed-in mode** (accounts, synced preferences,
personal term bank/TM, cloud projects, live collaboration) is powered by
[Supabase](https://supabase.com) and is **strictly additive**: when the
environment variables below are unset, the app loads no Supabase code and
behaves byte-for-byte like the local-only build.

This document is the one-time, human setup checklist. It is also the manual test
matrix for the phases that touch the backend (Milestones 3–5), since vitest
never talks to a real Supabase instance.

## 0. This deployment

The live Verbalis project is already provisioned:

| | |
| --- | --- |
| Project ref | `qutcuzlppbjbsymowavc` (region `us-east-2`, Postgres 17) |
| `VITE_SUPABASE_URL` | `https://qutcuzlppbjbsymowavc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_c8YdrT2-abKdW1Kl7FDKyA_v5OwqLdY` (publishable — safe in the bundle) |

These two values are also in `.env.example` — copy it to `.env.local` for local
dev. **Never** commit the `sb_secret_...` service key; Verbalis is client-side
and never uses it.

Migrations `0001_profiles` and `0002_profiles_hardening` are already applied to
this project (the security linter reports no outstanding issues). Remaining
setup is the dashboard config in §4 (redirect URLs + providers) and, for
production, the repository Variables in §1.

## 1. Environment variables

Set these at build time (e.g. in the CI/deploy environment). Leaving
`VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` unset keeps the app local-only.

**Production (GitHub Pages / `deploy.yml`)**: add them under *Settings → Secrets
and variables → Actions*. A repository **Variable** is the natural home (all
three are public — they end up in the client bundle), but `deploy.yml` accepts
either a Variable or a Secret via a fallback chain, and also accepts the URL
under the unprefixed name `SUPABASE_URL`:

- `VITE_SUPABASE_URL` ← `vars.VITE_SUPABASE_URL` → `secrets.VITE_SUPABASE_URL` → `secrets.SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` ← `vars.VITE_SUPABASE_ANON_KEY` → `secrets.VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_PROVIDERS` ← `vars.VITE_AUTH_PROVIDERS` → `secrets.VITE_AUTH_PROVIDERS` (optional; defaults to `google`)

Until they are set, production keeps building the 100%-local app. **Never** set
a `VITE_`-prefixed secret key — only the publishable/anon key belongs in the
build; the `sb_secret_...` key must never reach the client bundle.

**Local dev**: `cp .env.example .env.local` (git-ignored) and run `pnpm dev`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes (to enable cloud) | Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | yes (to enable cloud) | The project's anon / publishable key (safe to ship in a client bundle) |
| `VITE_AUTH_PROVIDERS` | no | Comma-separated OAuth providers to show, using **Supabase provider ids**: `google,azure,apple`. Defaults to `google`. Providers not configured server-side are simply hidden. |

> Note on provider ids: Microsoft is `azure` (not `microsoft`) in Supabase Auth.

## 2. Create the Supabase project

1. Create a project at <https://supabase.com/dashboard>.
2. Copy the **Project URL** and **anon key** (Settings → API) into the env vars above.
3. Free tier pauses after ~1 week idle and caps the DB at 500 MB — fine for
   development; plan a keep-alive or a paid tier before inviting real
   collaborators (Milestone 4+).

## 3. Apply the database migrations

Migrations live in `supabase/migrations/`. **For this project they are already
applied** (via the Supabase MCP). To reproduce on a fresh project, run the
Supabase CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

…or paste each file into the dashboard SQL editor in order. They are idempotent
and safe to re-run:

- `0001_profiles.sql` — one profile row per user + owner-scoped RLS + a signup
  trigger seeding the profile from provider metadata.
- `0002_profiles_hardening.sql` — pins the trigger functions' `search_path` and
  revokes their RPC EXECUTE grants (clears the database linter's SECURITY lints).
- `0003_user_settings.sql` — per-user, per-key synced preferences
  (`user_settings(user_id, key, value jsonb, updated_at)`) + owner-scoped RLS.
  `updated_at` is client-supplied so per-key last-write-wins works across
  devices. Backs Phase 3.3; **MT API keys are never written here** (the sync
  allowlist lives in `src/storage/cloud/settingsSync.ts`).
- `0004_personal_resources.sql` — the user's personal term bank + TM
  (`personal_glossary` / `personal_tm`, each `id, user_id, updated_at, deleted,
  payload jsonb`) + owner-scoped RLS. A generic cursor-based reconciler
  (`src/storage/cloud/rowSync.ts`) syncs them with per-row LWW and soft-delete
  tombstones. Backs Phase 3.4; **bundled corpora never sync** (corpus-seeded TM
  carries a `corpusId` and is filtered out).
- `0005_projects.sql` — cloud (collaborative) projects: `projects`,
  `project_members` (role enum `project_manager`/`translator`/`revisor`),
  `ydoc_state` (compacted Yjs snapshot) and append-only `ydoc_updates`
  (author-stamped), all behind member-scoped RLS, plus a private
  `project-files` storage bucket. Backs Phase 4.1.
- `0006_projects_helpers_private.sql` — moves the `is_project_member` /
  `has_project_role` RLS helpers into a non-API `private` schema so they are not
  reachable as PostgREST RPCs (clears the database linter). Apply after `0005`.
- `0007_compaction.sql` — the `claim_compaction(project_id, expected_seq, state,
  up_to_id)` RPC (SECURITY DEFINER, membership-checked): optimistically installs
  a fresh compacted `ydoc_state` snapshot (guarded by the `seq` generation) and
  prunes the subsumed `ydoc_updates` rows, so the append log stays bounded. Backs
  Phase 4.3. Apply after `0006`. *(Numbering note: ROADMAP §4.3 sketched
  `0005_compaction.sql`, but `0005`/`0006` were taken by the 4.1 project
  migrations, so it ships as `0007`; and the RPC signature is widened from the
  sketch's `(project_id, expected_seq)` to also carry the new snapshot + the
  pruned-through id, so the whole compaction is one atomic, RLS-safe
  transaction.)*

> Note: the linter's "Leaked Password Protection Disabled" warning is unrelated
> to these migrations — it's an optional **Authentication → Policies** toggle
> (HaveIBeenPwned checks) that only affects email/password signups, which
> Verbalis does not use. Enable it if you like; it changes nothing here.

## 4. Configure Auth providers

In the Supabase dashboard under **Authentication → Providers**:

- **Google** — create an OAuth client in Google Cloud Console, add the client
  id/secret. Enable the provider.
- **Microsoft (`azure`)** — register an app in Entra ID (Azure AD); add the
  client id/secret. Requires an Azure account.
- **Apple** — requires a paid **Apple Developer Program** membership ($99/yr);
  configure Service ID, key, and team id. Only add `apple` to
  `VITE_AUTH_PROVIDERS` once this is done, or the button will 400 on click.
- **Magic link (email OTP)** — enabled by default; no provider setup needed.

### Redirect URL allow-list (critical)

Verbalis is a **hash-routed static site**, so we pin Supabase's **PKCE** flow:
the `?code=` lands in the query string *before* the `#/route` fragment, and a
pre-router bootstrap (`src/storage/cloud/authBootstrap.ts`) exchanges it and
strips the query before React mounts. For this to work, add every origin you
serve from to **Authentication → URL Configuration → Redirect URLs**:

```
https://verbalis.britx.me/
http://localhost:5173/
```

Use the exact origin **with the trailing slash and no hash** — the app requests
`window.location.origin + window.location.pathname` as the redirect target.

## 5. Passkeys (honest status)

Passkeys are **not** natively supported by Supabase Auth today, so they are a
tracked fast-follow (Supabase roadmap or an Edge-Function WebAuthn flow) and are
**not** advertised in the v1 sign-in UI. Only Google/Microsoft/Apple OAuth and
magic links ship in Milestone 3.

## 6. Manual verification (Phase 3.1)

With env configured and deployed:

- [ ] The top bar shows a **Sign in** control (hidden entirely when env is unset).
- [ ] **Continue with Google** round-trips: click → provider → back to the app,
      now showing the account avatar. The URL never keeps a visible `?code=`.
- [ ] **Magic link**: enter an email → receive the link → clicking it signs in.
- [ ] The `profiles` row exists with the display name/avatar from the provider.
- [ ] **Sign out** returns to the signed-out state.
- [ ] With env unset, the production bundle contains **no** Supabase chunk in the
      initial graph and the app behaves exactly as the local-only build.

## 7. Manual verification (Phase 3.2)

Adds Microsoft/Apple provider buttons and an **Account** settings section.

- [ ] **Provider buttons follow `VITE_AUTH_PROVIDERS`**: set it to
      `google,azure,apple` → all three "Continue with …" buttons appear (each with
      its brand mark). Remove `apple` → the Apple button disappears without
      breaking the dialog. A provider listed here but **not** configured in the
      dashboard still renders, but 400s on click — only list configured ones.
- [ ] Microsoft (`azure`) and Apple round-trip like Google once configured in §4.
- [ ] **Settings → Account** appears only when the cloud is configured. Signed
      out, it offers a **Sign in** button; signed in, it shows:
  - [ ] an editable **Display name** that persists to the `profiles` row (reload,
        or open on a second device once 3.3 sync lands, to confirm) and updates
        the top-bar avatar/menu immediately;
  - [ ] the **Linked sign-in methods** (Google / Microsoft / Apple / Email) for
        the account;
  - [ ] a **Sign out** button returning to the signed-out state.
- [ ] With the cloud unset, the **Account** section is absent from Settings and no
      Supabase code is loaded.

## 8. Manual verification (Phase 3.3)

Syncs an allowlist of preferences (editor prefs, lookup defaults, spell-check)
to `user_settings` with per-key last-write-wins. Apply `0003_user_settings.sql`
first.

- [ ] Sign in on **machine A**, change an editor preference (e.g. toggle
      auto-propagate) and a lookup/spell default. Sign in on **machine B** with
      the same account → the changed values arrive after the sign-in pull.
- [ ] Change the same key on both devices while offline, then reconnect → the
      **newer** edit wins on both (per-key LWW), no crash.
- [ ] **MT provider settings never sync**: set a Claude/LibreTranslate API key on
      machine A → it does **not** appear on machine B (nor in `user_settings`).
- [ ] **Local-only unaffected**: with the cloud unset, settings still persist
      locally and no `user_settings` request is ever made.
- [ ] Sidebar **layout** sync ships separately in Phase 3.3.1 (§8.1 below) — the
      layout lives in a localStorage store, not Dexie.

### 8.1 Sidebar layout (Phase 3.3.1)

The sidebar layout (panel order + collapsed state) syncs through the same
`user_settings` table under the `sidebar.layout` key, with the same LWW, but
sourced from its zustand/localStorage store (not Dexie).

- [ ] Reorder or collapse panels on **machine A** while signed in → sign in on
      **machine B** (or reload it) and the layout arrives, applied live.
- [ ] Change the layout on both devices → the **newer** change wins on both.
- [ ] **Local-only unaffected**: signed out, the layout persists locally as
      before and no `sidebar.layout` request is made.

## 9. Manual verification (Phase 3.4)

Syncs the personal term bank + TM across a signed-in user's devices, with per-row
LWW and tombstones. Apply `0004_personal_resources.sql` first.

- [ ] Add glossary terms + TM entries on **machine A** while signed in. Sign in on
      **machine B** → they arrive after the sign-in reconcile.
- [ ] Edit the same term on both devices → the **newer** edit wins on both.
- [ ] **Delete doesn't resurrect**: delete a term on A → after B syncs it's gone on
      B and stays gone (a later sync never brings it back).
- [ ] **Bundled corpora never sync**: install a terminology corpus → its TM rows do
      **not** appear in `personal_tm`, and uninstalling on A doesn't touch B.
- [ ] **Local-only unaffected**: signed out, glossary/TM work exactly as before and
      no `personal_glossary`/`personal_tm` request is made (no tombstones written).

## 10. Manual verification (Phase 4.3 — Postgres persistence loop)

The persistence loop (`src/storage/cloud/ydocPersistence.ts`) makes Postgres the
source of truth for a cloud project's Yjs doc: catch-up on open, debounced
appends of local edits to `ydoc_updates`, and optimistic compaction into
`ydoc_state` via `claim_compaction`. Realtime (§4.2) is only the low-latency
channel. Apply `0007_compaction.sql` first. Two signed-in members, each having
opened the same published cloud project:

- [ ] **Catch-up on open**: member B opens the project → the doc arrives from
      Postgres (`ydoc_state` + `ydoc_updates`) even with Realtime idle.
- [ ] **Append**: member A edits → within ~½s a new `ydoc_updates` row appears,
      `author_id = A`. B (reopened, or after a reconnect) sees the edit.
- [ ] **Offline convergence**: take B offline, edit on both A (online) and B
      (offline), bring B back and reopen → both docs converge, no edit lost
      (Yjs replay is idempotent).
- [ ] **Compaction bounds the log**: drive `ydoc_updates` past ~200 rows → a
      client folds them into a new `ydoc_state` snapshot (its `seq` increments)
      and the log shrinks. With two clients compacting at once, only one wins
      (the `seq` guard) and the other no-ops — no lost updates.
- [ ] **Local-only unaffected**: a project with no `cloud` link makes no
      `ydoc_state`/`ydoc_updates` request; the BroadcastChannel/LAN path is
      unchanged.

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

**Production (GitHub Pages / `deploy.yml`)**: add them as repository **Variables**
under *Settings → Secrets and variables → Actions → Variables* — `deploy.yml`
reads `vars.VITE_SUPABASE_URL`, `vars.VITE_SUPABASE_ANON_KEY`, and
`vars.VITE_AUTH_PROVIDERS`. Variables (not Secrets) are correct here: all three
end up in the public client bundle. Until they are set, production keeps
building the 100%-local app.

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
- [ ] Sidebar **layout** sync is intentionally **not** in this phase — tracked as
      Phase 3.3.1 (the layout store has no LWW timestamps yet).

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

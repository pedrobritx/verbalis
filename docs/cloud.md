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

## 1. Environment variables

Set these at build time (e.g. in the CI/deploy environment). Leaving
`VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` unset keeps the app local-only.

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

Migrations live in `supabase/migrations/`. Apply them with the Supabase CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

…or paste each file into the dashboard SQL editor in order. Phase 3.1 ships
`0001_profiles.sql` (one profile row per user + owner-scoped RLS + a signup
trigger that seeds the profile from provider metadata).

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

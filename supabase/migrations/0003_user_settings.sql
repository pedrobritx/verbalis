-- Verbalis cloud — 0003 user_settings (ROADMAP §3.3, D6)
--
-- Per-user, per-key synced preferences: the signed-in half of the settings that
-- Dexie holds locally. Each row is one settings key (editor prefs, lookup
-- defaults, spell-check) with its JSON value and the wall-clock time it last
-- changed, which the client uses for per-key last-write-wins reconciliation
-- across devices. **MT provider settings (API keys) are never written here** —
-- the allowlist lives in `src/storage/cloud/settingsSync.ts`.
--
-- `updated_at` is **client-supplied** (the moment the value changed locally), so
-- LWW is meaningful across devices; there is deliberately no touch-trigger that
-- would overwrite it with the server clock. Owner-scoped RLS keeps every row
-- private to its user.
--
-- Numbering note: ROADMAP §3.3 sketched this as `0002_user_settings.sql`, but
-- `0002` was taken by `0002_profiles_hardening.sql` (a 3.1 follow-up), so this is
-- `0003`; the personal-resources migration in 3.4 shifts to `0004`.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- Idempotent; safe to re-run.

create table if not exists public.user_settings (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

comment on table public.user_settings is
  'Per-user synced settings (editor/lookup/spell). One row per (user_id, key); client-supplied updated_at drives per-key LWW.';

alter table public.user_settings enable row level security;

-- Owner-scoped: a user reads and writes only their own settings rows.
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own"
  on public.user_settings for delete
  using (auth.uid() = user_id);

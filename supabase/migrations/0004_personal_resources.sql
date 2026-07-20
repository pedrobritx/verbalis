-- Verbalis cloud — 0004 personal resources (ROADMAP §3.4, D6)
--
-- The user's personal term bank and translation memory, synced across their
-- devices by a cursor-based incremental reconciler with per-row last-write-wins
-- (`src/storage/cloud/rowSync.ts`). Bundled terminology corpora never sync —
-- only rows the user authored.
--
-- Each table is a generic sync envelope: the client `id` (a uuid), the owner,
-- a **client-supplied** `updated_at` (so LWW is meaningful across devices — no
-- touch-trigger), a soft-delete `deleted` flag (a delete is an upsert with
-- `deleted = true` and a fresh `updated_at`, which is how deletions propagate
-- without resurrecting), and the row body as `payload` jsonb. Keeping the body
-- opaque lets one engine drive both resources; Postgres never needs to query
-- inside it (that is what the local Dexie tables are for).
--
-- Numbering note: ROADMAP §3.4 sketched this as `0003_personal_resources.sql`,
-- but `0003` was taken by `0003_user_settings.sql` (Phase 3.3), so this is `0004`.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- Idempotent; safe to re-run.

create table if not exists public.personal_glossary (
  id         uuid        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  payload    jsonb       not null default '{}'::jsonb
);

create table if not exists public.personal_tm (
  id         uuid        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  payload    jsonb       not null default '{}'::jsonb
);

comment on table public.personal_glossary is
  'Per-user term bank, synced with per-row LWW. deleted=true is a tombstone. Bundled corpora never land here.';
comment on table public.personal_tm is
  'Per-user translation memory, synced with per-row LWW. deleted=true is a tombstone. Corpus-seeded TM never lands here.';

-- Cursor pulls read `where user_id = auth.uid() and updated_at > cursor`.
create index if not exists personal_glossary_user_updated_idx
  on public.personal_glossary (user_id, updated_at);
create index if not exists personal_tm_user_updated_idx
  on public.personal_tm (user_id, updated_at);

alter table public.personal_glossary enable row level security;
alter table public.personal_tm       enable row level security;

-- Owner-scoped access for both tables (select/insert/update/delete).
drop policy if exists "personal_glossary_select_own" on public.personal_glossary;
create policy "personal_glossary_select_own"
  on public.personal_glossary for select using (auth.uid() = user_id);
drop policy if exists "personal_glossary_insert_own" on public.personal_glossary;
create policy "personal_glossary_insert_own"
  on public.personal_glossary for insert with check (auth.uid() = user_id);
drop policy if exists "personal_glossary_update_own" on public.personal_glossary;
create policy "personal_glossary_update_own"
  on public.personal_glossary for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "personal_glossary_delete_own" on public.personal_glossary;
create policy "personal_glossary_delete_own"
  on public.personal_glossary for delete using (auth.uid() = user_id);

drop policy if exists "personal_tm_select_own" on public.personal_tm;
create policy "personal_tm_select_own"
  on public.personal_tm for select using (auth.uid() = user_id);
drop policy if exists "personal_tm_insert_own" on public.personal_tm;
create policy "personal_tm_insert_own"
  on public.personal_tm for insert with check (auth.uid() = user_id);
drop policy if exists "personal_tm_update_own" on public.personal_tm;
create policy "personal_tm_update_own"
  on public.personal_tm for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "personal_tm_delete_own" on public.personal_tm;
create policy "personal_tm_delete_own"
  on public.personal_tm for delete using (auth.uid() = user_id);

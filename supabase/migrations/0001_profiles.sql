-- Verbalis cloud — 0001 profiles (ROADMAP §3.1, D6/D8)
--
-- The first structured row the accounts feature needs: one profile per auth
-- user, holding the mutable display name + avatar shown on comments, tracked
-- changes, and (later) collaboration presence. RLS is owner-scoped; a signup
-- trigger seeds the row from the OAuth/OTP metadata so the client never has to.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- Idempotent enough to re-run in a fresh project; see docs/cloud.md.

create table if not exists public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Per-user profile (display name, avatar). One row per auth.users id.';

alter table public.profiles enable row level security;

-- Owner-scoped access: a user sees and edits only their own profile. Broader
-- read access for member lookup (invite-by-email) arrives with roles in 5.1,
-- deliberately kept out of the base install to stay least-privilege.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Keep updated_at honest on every write.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Seed a profile when a new auth user is created, pulling the display name and
-- avatar out of the provider metadata (Google/Apple/Azure) or magic-link OTP.
-- SECURITY DEFINER so it can write to public.profiles from the auth schema hook.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Verbalis cloud — 0005 cloud projects + roles + Yjs persistence (ROADMAP §4.1, D6/D8)
--
-- The structured spine of a cloud (collaborative) project. Per D6, the *content*
-- source of truth stays a Yjs blob — `ydoc_state` (compacted snapshot) plus an
-- append-only `ydoc_updates` log — while Postgres holds only what it must query
-- or enforce: the project row, its members + roles, and the Yjs blobs behind
-- member-scoped RLS. Every update row is stamped `author_id = auth.uid()`, so
-- attribution is tamper-evident (D8). Idempotent; apply after 0001–0004.

-- Roles a member can hold on a project.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_role') then
    create type public.project_role as enum ('project_manager', 'translator', 'revisor');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  source_lang text        not null,
  target_lang text        not null,
  owner_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.projects is 'A collaborative cloud project (ROADMAP §4.1).';

create table if not exists public.project_members (
  project_id uuid              not null references public.projects (id) on delete cascade,
  user_id    uuid              not null references auth.users (id) on delete cascade,
  role       public.project_role not null,
  created_at timestamptz       not null default now(),
  primary key (project_id, user_id)
);
comment on table public.project_members is 'Membership + role per (project, user).';

-- Compacted whole-doc snapshot; one row per project (Yjs V1 update bytes).
create table if not exists public.ydoc_state (
  project_id uuid        primary key references public.projects (id) on delete cascade,
  state      bytea       not null,
  seq        bigint      not null default 0,
  updated_at timestamptz not null default now()
);
comment on table public.ydoc_state is 'Compacted Yjs document snapshot per project (D6).';

-- Append-only Yjs update log. author_id is server-defaulted for attribution.
create table if not exists public.ydoc_updates (
  id         bigint      generated always as identity primary key,
  project_id uuid        not null references public.projects (id) on delete cascade,
  "update"   bytea       not null,
  author_id  uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ydoc_updates_project_seq on public.ydoc_updates (project_id, id);
comment on table public.ydoc_updates is 'Append-only authored Yjs update log (D6/D8).';

-- ---------------------------------------------------------------------------
-- Membership helpers — SECURITY DEFINER so RLS policies on project_members can
-- call them without recursing into project_members' own policies. search_path
-- is pinned and EXECUTE is granted to authenticated only.
-- ---------------------------------------------------------------------------

create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_project_role(pid uuid, roles public.project_role[])
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;

revoke execute on function public.is_project_member(uuid) from anon, public;
revoke execute on function public.has_project_role(uuid, public.project_role[]) from anon, public;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.has_project_role(uuid, public.project_role[]) to authenticated;

-- Keep projects.updated_at honest (touch_updated_at defined in 0001/0002).
drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.ydoc_state      enable row level security;
alter table public.ydoc_updates    enable row level security;

-- projects: members read; owner creates/deletes; a project_manager updates.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select
  using (owner_id = auth.uid() or public.is_project_member(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert
  with check (owner_id = auth.uid());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update
  using (public.has_project_role(id, array['project_manager']::public.project_role[]))
  with check (public.has_project_role(id, array['project_manager']::public.project_role[]));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete
  using (owner_id = auth.uid());

-- project_members: members read the roster; the project owner manages it (5.1
-- refines management to any project_manager). Self-insert by the owner on
-- publish is covered because the project's owner_id is auth.uid().
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members for select
  using (public.is_project_member(project_id));

drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members for insert
  with check (exists (
    select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()
  ));

drop policy if exists members_update on public.project_members;
create policy members_update on public.project_members for update
  using (exists (
    select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()
  ));

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members for delete
  using (exists (
    select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()
  ));

-- ydoc_state: members read and write the snapshot (compaction refined in 4.3).
drop policy if exists ydoc_state_select on public.ydoc_state;
create policy ydoc_state_select on public.ydoc_state for select
  using (public.is_project_member(project_id));

drop policy if exists ydoc_state_write on public.ydoc_state;
create policy ydoc_state_write on public.ydoc_state for insert
  with check (public.is_project_member(project_id));

drop policy if exists ydoc_state_update on public.ydoc_state;
create policy ydoc_state_update on public.ydoc_state for update
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- ydoc_updates: members read; members append only their own attributed rows.
drop policy if exists ydoc_updates_select on public.ydoc_updates;
create policy ydoc_updates_select on public.ydoc_updates for select
  using (public.is_project_member(project_id));

drop policy if exists ydoc_updates_insert on public.ydoc_updates;
create policy ydoc_updates_insert on public.ydoc_updates for insert
  with check (public.is_project_member(project_id) and author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for cloud-project assets, member-scoped by the first
-- path segment ({projectId}/…). Forward-looking for image/asset sync.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

drop policy if exists project_files_all on storage.objects;
create policy project_files_all on storage.objects for all
  using (
    bucket_id = 'project-files'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'project-files'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- Verbalis cloud — 0006 move membership helpers into a private (non-API) schema
--
-- The 0005 helpers `is_project_member` / `has_project_role` are SECURITY DEFINER
-- (so RLS on project_members can call them without recursing). In `public` they
-- are also reachable as PostgREST RPCs, which the database linter flags. Moving
-- them to a `private` schema (not exposed by the API) keeps RLS working while
-- removing the RPC surface — the Supabase-recommended pattern. EXECUTE stays
-- granted to `authenticated` only, so policy evaluation can still call them.
-- Idempotent; apply after 0005.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_project_member(pid uuid)
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

create or replace function private.has_project_role(pid uuid, roles public.project_role[])
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

revoke execute on function private.is_project_member(uuid) from anon, public;
revoke execute on function private.has_project_role(uuid, public.project_role[]) from anon, public;
grant execute on function private.is_project_member(uuid) to authenticated;
grant execute on function private.has_project_role(uuid, public.project_role[]) to authenticated;

-- Repoint every 0005 policy at the private helpers.
alter policy projects_select on public.projects
  using (owner_id = auth.uid() or private.is_project_member(id));
alter policy projects_update on public.projects
  using (private.has_project_role(id, array['project_manager']::public.project_role[]))
  with check (private.has_project_role(id, array['project_manager']::public.project_role[]));

alter policy members_select on public.project_members
  using (private.is_project_member(project_id));

alter policy ydoc_state_select on public.ydoc_state
  using (private.is_project_member(project_id));
alter policy ydoc_state_write on public.ydoc_state
  with check (private.is_project_member(project_id));
alter policy ydoc_state_update on public.ydoc_state
  using (private.is_project_member(project_id))
  with check (private.is_project_member(project_id));

alter policy ydoc_updates_select on public.ydoc_updates
  using (private.is_project_member(project_id));
alter policy ydoc_updates_insert on public.ydoc_updates
  with check (private.is_project_member(project_id) and author_id = auth.uid());

alter policy project_files_all on storage.objects
  using (
    bucket_id = 'project-files'
    and private.is_project_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'project-files'
    and private.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- Remove the now-unused public (RPC-exposed) helpers.
drop function if exists public.is_project_member(uuid);
drop function if exists public.has_project_role(uuid, public.project_role[]);

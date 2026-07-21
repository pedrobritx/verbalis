-- Verbalis cloud — 0008 member management: PM-only writes + invite-by-email
-- (ROADMAP §5.1, D8)
--
-- Phase 4.1 (0005/0006) seeded `project_members` with owner-only write policies.
-- Roles need more: any project_manager (not just the owner) may invite, change
-- roles, and remove members, and the project must never lose its last manager.
-- Invite is by email, which means resolving an email to a user id — done inside
-- a SECURITY DEFINER RPC so no email/id enumeration surface is exposed to the API
-- (the PM never reads other users' rows directly). The Members panel still needs
-- to show co-members' names, so profiles SELECT is broadened to project peers —
-- the "broader read access for member lookup" that 0001 deferred to this phase.
-- Idempotent; apply after 0007.

-- ---------------------------------------------------------------------------
-- profiles.email — needed to resolve an invite and to show who a member is.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists email text;

-- Backfill from auth.users, and keep it seeded on signup.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Broaden profiles SELECT to project co-members (least-privilege: only peers who
-- already share a project with the caller). SECURITY DEFINER helper avoids a
-- recursive RLS evaluation on project_members.
-- ---------------------------------------------------------------------------

create or replace function private.shares_project(other uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.project_members m1
    join public.project_members m2 on m1.project_id = m2.project_id
    where m1.user_id = auth.uid() and m2.user_id = other
  );
$$;

revoke execute on function private.shares_project(uuid) from anon, public;
grant  execute on function private.shares_project(uuid) to authenticated;

drop policy if exists profiles_select_comembers on public.profiles;
create policy profiles_select_comembers on public.profiles for select
  using (private.shares_project(id));

-- ---------------------------------------------------------------------------
-- PM-only member management. Insert stays reachable by the project owner (the
-- publish self-seed, before they are a member) OR any project_manager; role
-- changes + removals require a project_manager.
-- ---------------------------------------------------------------------------

drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members for insert
  with check (
    private.has_project_role(project_id, array['project_manager']::public.project_role[])
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

drop policy if exists members_update on public.project_members;
create policy members_update on public.project_members for update
  using (private.has_project_role(project_id, array['project_manager']::public.project_role[]))
  with check (private.has_project_role(project_id, array['project_manager']::public.project_role[]));

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members for delete
  using (private.has_project_role(project_id, array['project_manager']::public.project_role[]));

-- ---------------------------------------------------------------------------
-- Never leave a project without a manager. Fires on a demotion (update away from
-- project_manager) or a removal (delete) of the last remaining manager.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_min_one_pm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removing_pm boolean;
  v_remaining int;
begin
  if tg_op = 'DELETE' then
    v_removing_pm := (old.role = 'project_manager');
  else
    v_removing_pm := (old.role = 'project_manager' and new.role <> 'project_manager');
  end if;

  if v_removing_pm then
    select count(*) into v_remaining
    from public.project_members
    where project_id = old.project_id
      and role = 'project_manager'
      and user_id <> old.user_id;
    if v_remaining = 0 then
      raise exception 'a project must keep at least one project_manager';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists project_members_min_one_pm on public.project_members;
create trigger project_members_min_one_pm
  before update or delete on public.project_members
  for each row execute function public.enforce_min_one_pm();

-- ---------------------------------------------------------------------------
-- invite_member — PM invites a user by email. SECURITY DEFINER so the email→id
-- lookup and the membership upsert happen server-side with a PM check, exposing
-- no enumeration surface. Returns the invited user id, or NULL when no account
-- has that email; raises when the caller is not a project_manager.
-- ---------------------------------------------------------------------------

create or replace function public.invite_member(
  p_project_id uuid,
  p_email      text,
  p_role       public.project_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not private.has_project_role(p_project_id, array['project_manager']::public.project_role[]) then
    raise exception 'only a project_manager may invite members';
  end if;

  select id into v_user_id
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return null; -- no account with that email (yet)
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (p_project_id, v_user_id, p_role)
  on conflict (project_id, user_id) do update set role = excluded.role;

  return v_user_id;
end;
$$;

revoke execute on function public.invite_member(uuid, text, public.project_role) from anon, public;
grant  execute on function public.invite_member(uuid, text, public.project_role) to authenticated;

comment on function public.invite_member(uuid, text, public.project_role) is
  'PM-only: resolve an email to a user and upsert their project membership; NULL when no such account (ROADMAP §5.1).';

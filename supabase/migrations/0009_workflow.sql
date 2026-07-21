-- Verbalis cloud — 0009 project workflow stage + deadline (ROADMAP §5.2, D8)
--
-- Roles gate *content* editing per stage (client-enforced, D8); the stage itself
-- is a queryable project column so every member reads the same value and only a
-- project_manager can advance it. The existing `projects_update` policy (0005/
-- 0006) is already project_manager-only, so it covers stage/deadline writes with
-- no new policy. Idempotent; apply after 0008.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_stage') then
    create type public.project_stage as enum ('translation', 'review', 'final');
  end if;
end
$$;

alter table public.projects
  add column if not exists stage    public.project_stage not null default 'translation',
  add column if not exists deadline timestamptz;

comment on column public.projects.stage is
  'Workflow stage gating role-based editing (ROADMAP §5.2). project_manager-only writes via projects_update.';

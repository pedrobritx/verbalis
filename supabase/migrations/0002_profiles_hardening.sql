-- Verbalis cloud — 0002 profiles hardening (security-advisor follow-ups to 0001)
--
-- Clears the three SECURITY lints the Supabase database linter raises against
-- 0001's functions. Both functions are only ever invoked by their triggers, so
-- removing the RPC-callable EXECUTE grants and pinning the search_path changes
-- nothing about the signup / updated_at behaviour — triggers fire regardless of
-- the EXECUTE grant. Apply after 0001; idempotent (create or replace + revoke).

-- 1) Pin search_path on the updated_at trigger function (linter 0011).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Neither function is meant to be a client RPC. Revoke EXECUTE from the API
--    roles so they are unreachable via /rest/v1/rpc (linters 0028/0029 for the
--    SECURITY DEFINER signup seeder).
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

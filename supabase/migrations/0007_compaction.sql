-- Verbalis cloud — 0007 optimistic Yjs update-log compaction (ROADMAP §4.3, D6)
--
-- The append-only `ydoc_updates` log (0005) grows one row per edit burst. Left
-- unbounded it bloats the DB and slows every catch-up. Compaction folds the log
-- back into the `ydoc_state` snapshot: a client that sees the log cross a
-- threshold re-reads the snapshot + all updates, merges them locally into a new
-- Yjs state, and calls `claim_compaction` to install it — atomically, and only
-- if no other client compacted first.
--
-- Concurrency is optimistic. `ydoc_state.seq` is a compaction generation counter.
-- A caller passes the `seq` it based its merge on (`p_expected_seq`); the update
-- succeeds only while `seq` still matches, so two racing compactors can't both
-- win — the loser gets NULL back and simply drops its attempt (the log is
-- already bounded by the winner). `p_up_to_id` is the highest update id the new
-- snapshot subsumes; only those rows are pruned, so updates appended *during*
-- the merge (id > p_up_to_id) survive and replay on top of the fresh snapshot.
--
-- SECURITY DEFINER because pruning `ydoc_updates` has no DELETE policy by design
-- (the log is append-only over the API to keep attribution tamper-evident, D8);
-- membership is enforced explicitly here instead. Idempotent; apply after 0006.

create or replace function public.claim_compaction(
  p_project_id  uuid,
  p_expected_seq bigint,
  p_state       bytea,
  p_up_to_id    bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_seq bigint;
begin
  -- Only a project member may compact (RLS is bypassed under SECURITY DEFINER).
  if not private.is_project_member(p_project_id) then
    raise exception 'not a project member';
  end if;

  -- Optimistic claim: bump the generation + install the snapshot only while the
  -- expected generation still holds. A concurrent compactor that already bumped
  -- seq leaves 0 rows matched → v_new_seq stays NULL.
  update public.ydoc_state
     set state = p_state,
         seq = p_expected_seq + 1,
         updated_at = now()
   where project_id = p_project_id
     and seq = p_expected_seq
  returning seq into v_new_seq;

  if v_new_seq is null then
    return null;
  end if;

  -- Prune only the updates the new snapshot subsumes; newer appends replay.
  delete from public.ydoc_updates
   where project_id = p_project_id
     and id <= p_up_to_id;

  return v_new_seq;
end;
$$;

revoke execute on function public.claim_compaction(uuid, bigint, bytea, bigint) from anon, public;
grant  execute on function public.claim_compaction(uuid, bigint, bytea, bigint) to authenticated;

comment on function public.claim_compaction(uuid, bigint, bytea, bigint) is
  'Optimistically install a compacted ydoc_state snapshot (seq guard) and prune subsumed ydoc_updates. Returns the new seq, or NULL if another compactor won (ROADMAP §4.3).';

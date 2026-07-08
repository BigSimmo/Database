-- Tenancy defense-in-depth (docs/tenancy-defense-in-depth-review.md §6, item 1).
--
-- retrieval_owner_matches(owner_filter, row_owner_id) previously returned TRUE for
-- EVERY row when owner_filter IS NULL (fail-open). Because RLS is service-role-only,
-- the retrieval RPCs had no database-level tenant floor: a future app-layer regression
-- that passed a NULL owner_filter would silently return every tenant's rows with no
-- alarm. Make the NULL case fail CLOSED (match no rows).
--
-- This is behaviour-neutral for every real path — no legitimate caller passes NULL:
--   * production authed      -> the owner's uuid            (exact-owner match)
--   * anon / public / demo / local-no-auth / test -> the public sentinel
--     '00000000-…' (src/lib/owner-scope.ts now returns the sentinel, never null)
--   * production without an owner -> throws before the RPC is called
-- Only the unreachable fail-open branch changes; the sentinel and exact-owner
-- branches are untouched, so the golden retrieval eval (which passes the sentinel)
-- is unaffected.

set search_path = public, extensions, pg_temp;

create or replace function public.retrieval_owner_matches(owner_filter uuid, row_owner_id uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_catalog
as $$
  select case
    when owner_filter is null then false -- fail CLOSED (was: true) — no DB-level global escape hatch
    when owner_filter = '00000000-0000-0000-0000-000000000000'::uuid then row_owner_id is null -- public corpus only
    else row_owner_id = owner_filter -- exact owner
  end;
$$;

-- Self-verify the truth table so a bad redefinition fails the migration (on live and
-- on Supabase Preview) instead of silently shipping a tenancy regression.
do $verify$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  sentinel uuid := '00000000-0000-0000-0000-000000000000';
begin
  if public.retrieval_owner_matches(null, a) is not false then
    raise exception 'retrieval_owner_matches(NULL, uuid) must be FALSE (fail-closed)';
  end if;
  if public.retrieval_owner_matches(null, null) is not false then
    raise exception 'retrieval_owner_matches(NULL, NULL) must be FALSE (fail-closed)';
  end if;
  if public.retrieval_owner_matches(sentinel, null) is not true then
    raise exception 'retrieval_owner_matches(sentinel, NULL) must be TRUE (public row)';
  end if;
  if public.retrieval_owner_matches(sentinel, a) is not false then
    raise exception 'retrieval_owner_matches(sentinel, owned) must be FALSE (public-only)';
  end if;
  if public.retrieval_owner_matches(a, a) is not true then
    raise exception 'retrieval_owner_matches(owner, same owner) must be TRUE';
  end if;
  if public.retrieval_owner_matches(a, b) is not false then
    raise exception 'retrieval_owner_matches(owner, other owner) must be FALSE';
  end if;
end
$verify$;

-- Preview branches that applied the no-op 20260705210000 revision never created
-- retrieval_owner_matches(). Later migrations in this chain (20260706130000+) call it,
-- so the helper must exist before those run. Idempotent on live.

set search_path = public, extensions, pg_temp;

create or replace function public.retrieval_owner_matches(owner_filter uuid, row_owner_id uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_catalog
as $$
  select case
    when owner_filter is null then true
    when owner_filter = '00000000-0000-0000-0000-000000000000'::uuid then row_owner_id is null
    else row_owner_id = owner_filter
  end;
$$;

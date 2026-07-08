-- Preview branches that applied the earlier no-op version of 20260705210000 never
-- created retrieval_owner_matches(), so 20260706130000+ migrations fail. This
-- additive migration is idempotent on live and replays safely on stuck previews.

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

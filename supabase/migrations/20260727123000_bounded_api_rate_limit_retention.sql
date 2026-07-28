-- Bound durable rate-limit state without turning cleanup into an unbounded delete.
-- This migration installs the service-role-only primitive only. Scheduling it
-- hourly is an operator decision made when the migration is approved/applied.

create or replace function public.purge_expired_api_rate_limits(p_limit integer default 5000)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 5000), 1), 5000);
  v_cutoff timestamptz := now() - interval '24 hours';
  v_owner_deleted integer := 0;
  v_subject_deleted integer := 0;
begin
  with candidates as materialized (
    select 'owner'::text as limiter_kind, owner_id::text as limiter_key, bucket, updated_at
    from public.api_rate_limits
    where updated_at < v_cutoff
    union all
    select 'subject'::text as limiter_kind, subject_key as limiter_key, bucket, updated_at
    from public.api_rate_limit_subjects
    where updated_at < v_cutoff
    order by updated_at, limiter_kind, limiter_key, bucket
    limit v_limit
  ),
  deleted_owners as (
    delete from public.api_rate_limits as limits
    using candidates
    where candidates.limiter_kind = 'owner'
      and limits.owner_id::text = candidates.limiter_key
      and limits.bucket = candidates.bucket
      and limits.updated_at < v_cutoff
    returning 1
  ),
  deleted_subjects as (
    delete from public.api_rate_limit_subjects as limits
    using candidates
    where candidates.limiter_kind = 'subject'
      and limits.subject_key = candidates.limiter_key
      and limits.bucket = candidates.bucket
      and limits.updated_at < v_cutoff
    returning 1
  )
  select
    (select count(*)::integer from deleted_owners),
    (select count(*)::integer from deleted_subjects)
  into v_owner_deleted, v_subject_deleted;

  return jsonb_build_object(
    'deleted', v_owner_deleted + v_subject_deleted,
    'owner_deleted', v_owner_deleted,
    'subject_deleted', v_subject_deleted,
    'limit', v_limit,
    'cutoff', v_cutoff
  );
end;
$$;

revoke execute on function public.purge_expired_api_rate_limits(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.purge_expired_api_rate_limits(integer)
  to service_role;


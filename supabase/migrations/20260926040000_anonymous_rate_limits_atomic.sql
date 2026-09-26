set lock_timeout = '5s';
set statement_timeout = '30s';

-- One round trip for the anonymous subject, global and (optionally) generation-ceiling checks that
-- src/lib/api-rate-limit.ts used to make as up to three serial RPCs. From the app's region each RPC
-- costs a cross-region round trip, so an anonymous answer paid ~1.4 s here before any search ran.
--
-- Semantics are the serial path's exactly: each step is the existing consume_api_subject_rate_limit,
-- run in the same order, and a denial returns before any later step is consumed, so a caller denied
-- by a narrower limit never burns the shared global or ceiling allowance.
create or replace function public.consume_anonymous_rate_limits_atomic(
  p_subject_key text,
  p_bucket text,
  p_subject_limit integer,
  p_subject_window_seconds integer,
  p_global_key text,
  p_global_limit integer,
  p_global_window_seconds integer,
  p_ceiling_key text,
  p_ceiling_bucket text,
  p_ceiling_limit integer,
  p_ceiling_window_seconds integer
)
returns table (
  scope text,
  limited boolean,
  limit_value integer,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject record;
  v_global record;
  v_ceiling record;
  v_remaining integer;
begin
  if (p_ceiling_key is null) <> (p_ceiling_bucket is null)
    or (p_ceiling_key is null) <> (p_ceiling_limit is null)
    or (p_ceiling_key is null) <> (p_ceiling_window_seconds is null) then
    raise exception 'ceiling key, bucket, limit and window must be given together';
  end if;

  select * into v_subject
  from public.consume_api_subject_rate_limit(p_subject_key, p_bucket, p_subject_limit, p_subject_window_seconds);
  if v_subject.limited then
    return query select 'subject'::text, true, v_subject.limit_value, v_subject.remaining,
      v_subject.retry_after_seconds, v_subject.reset_at;
    return;
  end if;
  v_remaining := v_subject.remaining;

  select * into v_global
  from public.consume_api_subject_rate_limit(p_global_key, p_bucket, p_global_limit, p_global_window_seconds);
  if v_global.limited then
    return query select 'global'::text, true, v_global.limit_value, v_global.remaining,
      v_global.retry_after_seconds, v_global.reset_at;
    return;
  end if;
  v_remaining := least(v_remaining, v_global.remaining);

  if p_ceiling_key is not null then
    select * into v_ceiling
    from public.consume_api_subject_rate_limit(p_ceiling_key, p_ceiling_bucket, p_ceiling_limit, p_ceiling_window_seconds);
    if v_ceiling.limited then
      return query select 'ceiling'::text, true, v_ceiling.limit_value, v_ceiling.remaining,
        v_ceiling.retry_after_seconds, v_ceiling.reset_at;
      return;
    end if;
    v_remaining := least(v_remaining, v_ceiling.remaining);
  end if;

  return query select
    null::text,
    false,
    v_subject.limit_value,
    v_remaining,
    v_subject.retry_after_seconds,
    v_subject.reset_at;
end;
$$;

revoke execute on function public.consume_anonymous_rate_limits_atomic(
  text, text, integer, integer, text, integer, integer, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.consume_anonymous_rate_limits_atomic(
  text, text, integer, integer, text, integer, integer, text, text, integer, integer
) to service_role;

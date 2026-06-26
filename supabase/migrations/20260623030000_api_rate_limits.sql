set search_path = public, extensions, pg_temp;

create table if not exists public.api_rate_limits (
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, bucket),
  constraint api_rate_limits_bucket_nonempty check (btrim(bucket) <> '')
);

create index if not exists api_rate_limits_bucket_updated_idx
  on public.api_rate_limits(bucket, updated_at desc);

create or replace function public.consume_api_rate_limit(
  p_owner_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  limited boolean,
  limit_value integer,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now;
  v_count integer;
  v_reset_at timestamptz;
begin
  if p_owner_id is null then
    raise exception 'owner_id is required';
  end if;
  if p_bucket is null or btrim(p_bucket) = '' then
    raise exception 'bucket is required';
  end if;
  if p_limit < 1 then
    raise exception 'limit must be positive';
  end if;
  if p_window_seconds < 1 then
    raise exception 'window must be positive';
  end if;

  loop
    update public.api_rate_limits
    set
      window_start = case
        when window_start + make_interval(secs => p_window_seconds) <= v_now then v_window_start
        else window_start
      end,
      request_count = case
        when window_start + make_interval(secs => p_window_seconds) <= v_now then 1
        else request_count + 1
      end,
      updated_at = v_now
    where owner_id = p_owner_id
      and bucket = p_bucket
    returning request_count, window_start + make_interval(secs => p_window_seconds)
      into v_count, v_reset_at;

    exit when found;

    begin
      insert into public.api_rate_limits(owner_id, bucket, window_start, request_count, updated_at)
      values (p_owner_id, p_bucket, v_window_start, 1, v_now)
      returning request_count, window_start + make_interval(secs => p_window_seconds)
        into v_count, v_reset_at;
      exit;
    exception when unique_violation then
      -- Another request created the bucket first; retry and update it atomically.
    end;
  end loop;

  return query
  select
    v_count > p_limit as limited,
    p_limit as limit_value,
    greatest(p_limit - v_count, 0) as remaining,
    greatest(1, ceiling(extract(epoch from (v_reset_at - v_now)))::integer) as retry_after_seconds,
    v_reset_at as reset_at;
end;
$$;

revoke all privileges on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

revoke execute on function public.consume_api_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(uuid, text, integer, integer) to service_role;

alter table public.api_rate_limits enable row level security;

drop policy if exists "api rate limits service role all" on public.api_rate_limits;
create policy "api rate limits service role all" on public.api_rate_limits
  for all to service_role
  using (true)
  with check (true);

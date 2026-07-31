-- DB query performance: upsert rate-limit consume + searchable document_images index.
-- Applying to hosted Supabase remains an explicitly approved operator action.

set search_path = public, extensions, pg_temp;

-- Faster consume path: single INSERT ... ON CONFLICT instead of update/insert retry loop.
create or replace function public.consume_api_subject_rate_limit(
  p_subject_key text,
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
  if p_subject_key is null or btrim(p_subject_key) = '' then
    raise exception 'subject_key is required';
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

  insert into public.api_rate_limit_subjects(subject_key, bucket, window_start, request_count, updated_at)
  values (p_subject_key, p_bucket, v_window_start, 1, v_now)
  on conflict (subject_key, bucket) do update
  set
    window_start = case
      when public.api_rate_limit_subjects.window_start + make_interval(secs => p_window_seconds) <= v_now
        then excluded.window_start
      else public.api_rate_limit_subjects.window_start
    end,
    request_count = case
      when public.api_rate_limit_subjects.window_start + make_interval(secs => p_window_seconds) <= v_now
        then 1
      else public.api_rate_limit_subjects.request_count + 1
    end,
    updated_at = v_now
  returning request_count, window_start + make_interval(secs => p_window_seconds)
    into v_count, v_reset_at;

  return query
  select
    v_count > p_limit as limited,
    p_limit as limit_value,
    greatest(p_limit - v_count, 0) as remaining,
    greatest(1, ceiling(extract(epoch from (v_reset_at - v_now)))::integer) as retry_after_seconds,
    v_reset_at as reset_at;
end;
$$;

revoke execute on function public.consume_api_subject_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_subject_rate_limit(text, text, integer, integer) to service_role;

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

  insert into public.api_rate_limits(owner_id, bucket, window_start, request_count, updated_at)
  values (p_owner_id, p_bucket, v_window_start, 1, v_now)
  on conflict (owner_id, bucket) do update
  set
    window_start = case
      when public.api_rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now
        then excluded.window_start
      else public.api_rate_limits.window_start
    end,
    request_count = case
      when public.api_rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now
        then 1
      else public.api_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning request_count, window_start + make_interval(secs => p_window_seconds)
    into v_count, v_reset_at;

  return query
  select
    v_count > p_limit as limited,
    p_limit as limit_value,
    greatest(p_limit - v_count, 0) as remaining,
    greatest(1, ceiling(extract(epoch from (v_reset_at - v_now)))::integer) as retry_after_seconds,
    v_reset_at as reset_at;
end;
$$;

revoke execute on function public.consume_api_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(uuid, text, integer, integer) to service_role;

-- Matches attachPageVisualEvidence: searchable + document_id + page_number, ordered by relevance.
create index if not exists document_images_searchable_doc_page_relevance_idx
  on public.document_images (document_id, page_number, clinical_relevance_score desc nulls last)
  where searchable is true
    and image_type is distinct from 'logo_decorative';

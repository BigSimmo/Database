set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function public.consume_summary_rate_limits_atomic(
  p_owner_id uuid,
  p_subject_key text,
  p_answer_limit integer,
  p_answer_window_seconds integer,
  p_summary_limit integer,
  p_summary_window_seconds integer,
  p_global_answer_limit integer,
  p_global_answer_window_seconds integer
)
returns table (
  bucket text,
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
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_policy record;
  v_count integer;
  v_remaining integer;
  v_reset_at timestamptz;
  v_min_remaining integer := 2147483647;
  v_success_limit integer;
  v_success_reset_at timestamptz;
begin
  if (p_owner_id is null) = (p_subject_key is null or pg_catalog.btrim(p_subject_key) = '') then
    raise exception 'exactly one owner_id or subject_key is required';
  end if;
  if p_answer_limit is null or p_answer_limit < 1
    or p_answer_window_seconds is null or p_answer_window_seconds < 1
    or p_summary_limit is null or p_summary_limit < 1
    or p_summary_window_seconds is null or p_summary_window_seconds < 1
    or p_global_answer_limit is null or p_global_answer_limit < 1
    or p_global_answer_window_seconds is null or p_global_answer_window_seconds < 1 then
    raise exception 'limits and windows must be positive';
  end if;

  if p_owner_id is not null then
    insert into public.api_rate_limits (owner_id, bucket, window_start, request_count, updated_at)
    values
      (p_owner_id, 'answer', v_now, 0, v_now),
      (p_owner_id, 'document_summarize', v_now, 0, v_now)
    on conflict on constraint api_rate_limits_pkey do nothing;

    -- Acquire every participating row before incrementing, in one stable order.
    perform 1
    from public.api_rate_limits as rl
    where rl.owner_id = p_owner_id
      and rl.bucket in ('answer', 'document_summarize')
    order by rl.bucket
    for update;

    for v_policy in
      select *
      from (values
        ('answer'::text, 1, p_answer_limit, p_answer_window_seconds),
        ('document_summarize'::text, 2, p_summary_limit, p_summary_window_seconds)
      ) as policy(bucket, ordinal, limit_value, window_seconds)
      order by ordinal
    loop
      update public.api_rate_limits as rl
      set
        window_start = case
          when rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds) <= v_now then v_now
          else rl.window_start
        end,
        request_count = case
          when rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds) <= v_now then 1
          else rl.request_count + 1
        end,
        updated_at = v_now
      where rl.owner_id = p_owner_id and rl.bucket = v_policy.bucket
      returning rl.request_count,
        rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds)
      into v_count, v_reset_at;

      v_remaining := greatest(v_policy.limit_value - v_count, 0);
      if v_remaining < v_min_remaining then
        v_min_remaining := v_remaining;
        v_success_limit := v_policy.limit_value;
        v_success_reset_at := v_reset_at;
      end if;
      if v_count > v_policy.limit_value then
        return query select
          v_policy.bucket::text,
          true,
          v_policy.limit_value::integer,
          0,
          greatest(1, pg_catalog.ceil(extract(epoch from (v_reset_at - v_now)))::integer),
          v_reset_at;
        return;
      end if;
    end loop;
  else
    insert into public.api_rate_limit_subjects (subject_key, bucket, window_start, request_count, updated_at)
    values
      (p_subject_key, 'answer', v_now, 0, v_now),
      ('anon:answer:global', 'answer', v_now, 0, v_now),
      (p_subject_key, 'document_summarize', v_now, 0, v_now)
    on conflict on constraint api_rate_limit_subjects_pkey do nothing;

    -- Subject and global rows share one stable lexical lock order.
    perform 1
    from public.api_rate_limit_subjects as rl
    where (rl.subject_key, rl.bucket) in (
      (p_subject_key, 'answer'),
      ('anon:answer:global', 'answer'),
      (p_subject_key, 'document_summarize')
    )
    order by rl.subject_key, rl.bucket
    for update;

    for v_policy in
      select *
      from (values
        ('answer'::text, 1, p_subject_key, p_answer_limit, p_answer_window_seconds, 'answer'::text),
        ('answer'::text, 2, 'anon:answer:global', p_global_answer_limit, p_global_answer_window_seconds, 'answer'::text),
        ('document_summarize'::text, 3, p_subject_key, p_summary_limit, p_summary_window_seconds, 'document_summarize'::text)
      ) as policy(bucket, ordinal, subject_key, limit_value, window_seconds, rejection_bucket)
      order by ordinal
    loop
      update public.api_rate_limit_subjects as rl
      set
        window_start = case
          when rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds) <= v_now then v_now
          else rl.window_start
        end,
        request_count = case
          when rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds) <= v_now then 1
          else rl.request_count + 1
        end,
        updated_at = v_now
      where rl.subject_key = v_policy.subject_key and rl.bucket = v_policy.bucket
      returning rl.request_count,
        rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds)
      into v_count, v_reset_at;

      v_remaining := greatest(v_policy.limit_value - v_count, 0);
      if v_remaining < v_min_remaining then
        v_min_remaining := v_remaining;
        v_success_limit := v_policy.limit_value;
        v_success_reset_at := v_reset_at;
      end if;
      if v_count > v_policy.limit_value then
        return query select
          v_policy.rejection_bucket::text,
          true,
          v_policy.limit_value::integer,
          0,
          greatest(1, pg_catalog.ceil(extract(epoch from (v_reset_at - v_now)))::integer),
          v_reset_at;
        return;
      end if;
    end loop;
  end if;

  return query select
    null::text,
    false,
    v_success_limit,
    v_min_remaining,
    greatest(1, pg_catalog.ceil(extract(epoch from (v_success_reset_at - v_now)))::integer),
    v_success_reset_at;
end;
$$;

revoke execute on function public.consume_summary_rate_limits_atomic(
  uuid, text, integer, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.consume_summary_rate_limits_atomic(
  uuid, text, integer, integer, integer, integer, integer, integer
) to service_role;

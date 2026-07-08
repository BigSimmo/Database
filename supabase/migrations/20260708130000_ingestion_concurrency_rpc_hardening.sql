-- Ingestion concurrency RPC hardening (audit R1/R2, R7, R9, R23).
--
-- NOT YET APPLIED TO LIVE. Apply through the linked migration workflow with
-- operator approval, then run npm run check:drift + check:indexing (per
-- docs/supabase-migration-reconciliation.md). schema.sql is reconciled to match
-- these definitions and supabase/drift-manifest.json is regenerated in the same
-- change. Backward compatible: p_worker_id defaults null, so the 4-/8-arg calls
-- the current worker makes keep resolving to these functions until the worker is
-- redeployed to pass its worker id.
--
-- Companion state model + verified violations: docs/ingestion-state-machine.md.
-- Related shipped app-code fixes (PR #369): R11 janitor guard, R1 lease
-- heartbeat (worker refreshes locked_at). These RPC fences are the residual
-- defense-in-depth once a worker is genuinely reclaimed.

set search_path = public, extensions, pg_temp;

-- R9: serialize concurrent batch-status refreshes by locking the batch row
-- before counting, so the last two jobs of a batch cannot both compute
-- 'processing' from pre-commit snapshots and pin it forever.
create or replace function public.refresh_import_batch_status(p_batch_id uuid)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  queued_count integer := 0;
  processing_count integer := 0;
  failed_count integer := 0;
  next_status text;
begin
  if p_batch_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_batch_id');
  end if;

  perform 1 from public.import_batches where id = p_batch_id for update;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'failed')
  into queued_count, processing_count, failed_count
  from public.ingestion_jobs
  where batch_id = p_batch_id;

  next_status := case
    when queued_count > 0 or processing_count > 0 then 'processing'
    when failed_count > 0 then 'completed_with_errors'
    else 'completed'
  end;

  update public.import_batches
  set
    status = next_status,
    failed_files = failed_count,
    completed_at = case when next_status = 'processing' then null else now() end
  where id = p_batch_id;

  return jsonb_build_object(
    'ok', true,
    'status', next_status,
    'queued', queued_count,
    'processing', processing_count,
    'failed', failed_count
  );
end;
$$;

-- R1/R2: complete_ingestion_job gains an optional p_worker_id lease fence.
-- Signature change (added trailing param) → drop the old signature first so
-- create does not leave a stale overload.
drop function if exists public.complete_ingestion_job(uuid, uuid, uuid, text);

create or replace function public.complete_ingestion_job(
  p_job_id uuid,
  p_document_id uuid,
  p_batch_id uuid default null,
  p_stage text default 'indexed',
  p_worker_id text default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_matched integer;
begin
  update public.ingestion_jobs
  set
    status = 'completed',
    stage = p_stage,
    progress = 100,
    error_message = null,
    locked_at = null,
    locked_by = null,
    completed_at = now()
  where id = p_job_id
    and document_id = p_document_id
    and (p_worker_id is null or locked_by = p_worker_id);
  get diagnostics v_matched = row_count;

  if p_worker_id is not null and v_matched = 0 then
    return jsonb_build_object('ok', false, 'reason', 'lease_lost', 'job_id', p_job_id, 'document_id', p_document_id);
  end if;

  update public.ingestion_jobs
  set
    status = 'completed',
    stage = 'superseded by successful index',
    progress = 100,
    error_message = null,
    locked_at = null,
    locked_by = null,
    completed_at = now()
  where document_id = p_document_id
    and id <> p_job_id
    and status in ('pending', 'processing', 'failed');

  if p_batch_id is not null then
    perform public.refresh_import_batch_status(p_batch_id);
  end if;

  return jsonb_build_object('ok', true, 'job_id', p_job_id, 'document_id', p_document_id);
end;
$$;

-- R1/R2 lease fence + R7 attempt-exhaustion strand guard.
drop function if exists public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamptz);

create or replace function public.fail_or_retry_ingestion_job(
  p_job_id uuid,
  p_document_id uuid,
  p_batch_id uuid default null,
  p_retry boolean default false,
  p_document_status text default 'failed',
  p_stage text default 'failed',
  p_error_message text default null,
  p_next_run_at timestamptz default null,
  p_worker_id text default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_job public.ingestion_jobs%rowtype;
  v_retry boolean;
begin
  select * into v_job
  from public.ingestion_jobs
  where id = p_job_id and document_id = p_document_id
  for update;

  if p_worker_id is not null and (v_job.id is null or v_job.locked_by is distinct from p_worker_id) then
    return jsonb_build_object('ok', false, 'reason', 'lease_lost', 'job_id', p_job_id, 'document_id', p_document_id, 'retry', false);
  end if;

  v_retry := p_retry and coalesce(v_job.attempt_count, 0) < coalesce(v_job.max_attempts, 0);

  update public.documents
  set
    status = p_document_status,
    error_message = p_error_message
  where id = p_document_id;

  update public.ingestion_jobs
  set
    status = case when v_retry then 'pending' else 'failed' end,
    stage = p_stage,
    progress = case when v_retry then 0 else 100 end,
    error_message = p_error_message,
    locked_at = null,
    locked_by = null,
    next_run_at = coalesce(p_next_run_at, next_run_at),
    completed_at = case when v_retry then null else now() end
  where id = p_job_id
    and document_id = p_document_id;

  if p_batch_id is not null then
    perform public.refresh_import_batch_status(p_batch_id);
  end if;

  return jsonb_build_object('ok', true, 'job_id', p_job_id, 'document_id', p_document_id, 'retry', v_retry);
end;
$$;

-- R23: re-assert the open-job guard immediately before the destructive deletes
-- (it previously lived only in the candidate CTE, before the seven counts).
create or replace function public.cleanup_abandoned_document_index_generations(
  p_document_id uuid default null,
  p_limit integer default 100,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  target_document_ids uuid[] := '{}'::uuid[];
  chunk_count integer := 0;
  image_count integer := 0;
  table_fact_count integer := 0;
  embedding_field_count integer := 0;
  index_unit_count integer := 0;
  memory_card_count integer := 0;
  section_count integer := 0;
begin
  perform set_config('statement_timeout', '180000', true);

  with candidate_documents as (
    select distinct document_id
    from (
      select c.document_id
      from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where (p_document_id is null or c.document_id = p_document_id)
        and c.index_generation_id is not null
        and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = c.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_images a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_table_facts a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_embedding_fields a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_index_units a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_memory_cards a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_sections a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
    ) candidates
    limit least(greatest(coalesce(p_limit, 100), 1), 1000)
  )
  select coalesce(array_agg(document_id), '{}'::uuid[])
  into target_document_ids
  from candidate_documents;

  select count(*) into chunk_count
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.document_id = any(target_document_ids)
    and c.index_generation_id is not null
    and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into image_count
  from public.document_images a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into table_fact_count
  from public.document_table_facts a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into embedding_field_count
  from public.document_embedding_fields a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into index_unit_count
  from public.document_index_units a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into memory_card_count
  from public.document_memory_cards a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into section_count
  from public.document_sections a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  if not coalesce(p_dry_run, true) then
    select coalesce(array_agg(doc_id), '{}'::uuid[])
    into target_document_ids
    from unnest(target_document_ids) as doc_id
    where not exists (
      select 1 from public.ingestion_jobs j
      where j.document_id = doc_id
        and j.status in ('pending', 'processing')
    );

    delete from public.document_chunks c
    using public.documents d
    where d.id = c.document_id
      and c.document_id = any(target_document_ids)
      and c.index_generation_id is not null
      and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_images a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_table_facts a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_embedding_fields a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_index_units a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_memory_cards a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_sections a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');
  end if;

  return jsonb_build_object(
    'ok', true,
    'dry_run', coalesce(p_dry_run, true),
    'document_count', coalesce(array_length(target_document_ids, 1), 0),
    'document_ids', to_jsonb(target_document_ids),
    'counts', jsonb_build_object(
      'document_chunks', chunk_count,
      'document_images', image_count,
      'document_table_facts', table_fact_count,
      'document_embedding_fields', embedding_field_count,
      'document_index_units', index_unit_count,
      'document_memory_cards', memory_card_count,
      'document_sections', section_count
    )
  );
end;
$$;

revoke execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) to service_role;

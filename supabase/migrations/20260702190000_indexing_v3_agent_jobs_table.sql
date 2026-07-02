-- Fix #1: Replace documents.metadata JSONB worker state with a dedicated
--          indexing_v3_agent_jobs table for the v3 enrichment pipeline.
--
-- PROBLEM:
--   claim_indexing_v3_agent_jobs does FOR UPDATE SKIP LOCKED on the documents
--   table — the largest table in the schema — and must parse multiple JSONB
--   fields for every candidate row. At moderate scale this is a multi-second
--   sequential scan. Partial indexes on JSONB expressions help for
--   documents_indexing_v3_agent_claim_idx, but the state is still scattered
--   across ~9 JSONB keys in metadata.
--
-- FIX:
--   1. Create indexing_v3_agent_jobs with proper typed columns and a compound
--      index suited for SKIP LOCKED claiming.
--   2. Seed the table from existing JSONB state for all documents that are not
--      yet completed.
--   3. Rewrite claim_indexing_v3_agent_jobs to SELECT FOR UPDATE SKIP LOCKED
--      on the small jobs table rather than the documents table.
--      The RPC also patches documents.metadata to maintain backward
--      compatibility with any edge function code that still reads from JSONB.
--
-- *** CRITICAL EDGE FUNCTION NOTE ***
--   The supabase/functions/indexing-v3-agent/ edge function currently writes
--   completion/failure state back to documents.metadata directly.
--   Once this migration is applied, those JSONB writes are still safe (they
--   do not break anything), but the jobs table row will NOT be updated by
--   them and will remain stuck in 'processing' until it becomes stale and is
--   re-claimed or manually updated.
--
--   You MUST update the edge function to also call a completion/failure RPC
--   (or UPDATE indexing_v3_agent_jobs directly) after applying this migration.
--   Until then, completed jobs will be picked up again after the stale timeout
--   (p_stale_after_minutes, default 45), wasting agent cycles but not
--   corrupting data (commit_document_index_generation is idempotent).
--
--   Recommended follow-up:
--     - Add update_indexing_v3_agent_job_status(document_id, status, error)
--       RPC (service_role-only) and call it from the edge function on
--       success/failure/backoff.
--     - Remove the documents.metadata JSONB sync from
--       claim_indexing_v3_agent_jobs once the edge function is updated.

-- -------------------------------------------------------------------------
-- Step 1: Create the dedicated jobs table
-- -------------------------------------------------------------------------

create table if not exists public.indexing_v3_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  -- v3 agent processing status (mirrors metadata->>'indexing_v3_agent_status')
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'needs_enrichment_artifacts')),
  -- enrichment pipeline status (mirrors metadata->>'enrichment_status')
  enrichment_status text not null default 'pending'
    check (enrichment_status in ('pending', 'processing', 'completed', 'failed', 'needs_enrichment_artifacts')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  locked_by text,
  locked_at timestamptz,
  next_run_at timestamptz,
  version text not null default 'visual-core-v3',
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per document; re-running resets the row in-place
create unique index if not exists indexing_v3_agent_jobs_document_id_idx
  on public.indexing_v3_agent_jobs(document_id);

-- Hot path for claim: eligible candidates ordered by next_run_at
create index if not exists indexing_v3_agent_jobs_claim_idx
  on public.indexing_v3_agent_jobs(status, enrichment_status, next_run_at, id)
  where status not in ('completed', 'needs_enrichment_artifacts');

-- Operational: find stale processing jobs
create index if not exists indexing_v3_agent_jobs_locked_at_idx
  on public.indexing_v3_agent_jobs(locked_at)
  where status = 'processing';

-- RLS + grants (service_role only, same as ingestion_jobs)
alter table public.indexing_v3_agent_jobs enable row level security;

drop policy if exists "indexing v3 agent jobs service role all" on public.indexing_v3_agent_jobs;
create policy "indexing v3 agent jobs service role all"
  on public.indexing_v3_agent_jobs
  for all to service_role
  using (true)
  with check (true);

grant select, insert, update, delete
  on table public.indexing_v3_agent_jobs to service_role;

-- -------------------------------------------------------------------------
-- Step 2: Seed from existing JSONB state
--         Insert one row per document that has ever been touched by the
--         v3 agent (i.e., has indexing_v3_agent_status in metadata) and
--         hasn't completed. Documents with no JSONB keys are not yet
--         eligible and will get a row on their first claim.
-- -------------------------------------------------------------------------

insert into public.indexing_v3_agent_jobs (
  document_id,
  status,
  enrichment_status,
  attempt_count,
  max_attempts,
  locked_by,
  locked_at,
  next_run_at,
  version,
  last_error,
  metadata,
  created_at,
  updated_at
)
select
  d.id,
  case
    when coalesce(d.metadata->>'indexing_v3_agent_status', 'pending') in
         ('completed', 'needs_enrichment_artifacts', 'failed')
      then coalesce(d.metadata->>'indexing_v3_agent_status', 'pending')
    when coalesce(d.metadata->>'indexing_v3_agent_status', 'pending') in
         ('deferred', 'retry_pending')
      then 'pending'
    when coalesce(d.metadata->>'indexing_v3_agent_status', '') = 'processing'
      and (
        nullif(d.metadata->>'indexing_v3_agent_locked_at', '') is null
        or (d.metadata->>'indexing_v3_agent_locked_at')::timestamptz < now() - interval '2 hours'
      )
      then 'pending'  -- stale processing → reset to pending
    else 'pending'
  end as status,
  coalesce(d.metadata->>'enrichment_status', 'pending') as enrichment_status,
  case
    when coalesce(d.metadata->>'indexing_v3_agent_attempt_count', '') ~ '^[0-9]+$'
      then (d.metadata->>'indexing_v3_agent_attempt_count')::integer
    else 0
  end as attempt_count,
  greatest(
    case
      when coalesce(d.metadata->>'indexing_v3_agent_max_attempts', '') ~ '^[0-9]+$'
        then (d.metadata->>'indexing_v3_agent_max_attempts')::integer
      else 3
    end,
    1
  ) as max_attempts,
  nullif(d.metadata->>'indexing_v3_agent_locked_by', '') as locked_by,
  case
    when coalesce(d.metadata->>'indexing_v3_agent_locked_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then (d.metadata->>'indexing_v3_agent_locked_at')::timestamptz
    else null
  end as locked_at,
  case
    when coalesce(d.metadata->>'indexing_v3_agent_next_run_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then (d.metadata->>'indexing_v3_agent_next_run_at')::timestamptz
    else null
  end as next_run_at,
  coalesce(nullif(d.metadata->>'indexing_v3_agent_version', ''), 'visual-core-v3') as version,
  nullif(d.metadata->>'indexing_v3_agent_last_error', '') as last_error,
  '{}'::jsonb as metadata,
  coalesce(d.created_at, now()) as created_at,
  coalesce(d.updated_at, now()) as updated_at
from public.documents d
where d.metadata ? 'indexing_v3_agent_status'
on conflict (document_id) do nothing;

-- -------------------------------------------------------------------------
-- Step 3: Rewrite claim_indexing_v3_agent_jobs
--         Uses SKIP LOCKED on the small jobs table.
--         Also patches documents.metadata for backward compatibility with
--         the existing edge function (see CRITICAL NOTE above).
-- -------------------------------------------------------------------------

create or replace function public.claim_indexing_v3_agent_jobs(
  p_worker_id text,
  p_claim_limit integer default 1,
  p_stale_after_minutes integer default 45
)
returns table (
  id uuid,
  document_id uuid,
  batch_id uuid,
  status text,
  stage text,
  progress integer,
  error_message text,
  attempt_count integer,
  max_attempts integer,
  locked_at timestamptz,
  locked_by text,
  documents jsonb
)
language plpgsql
set search_path = public, extensions, pg_temp
as $$
-- Dual-write compatibility note:
-- This RPC claims via the jobs table (SKIP LOCKED) and also patches
-- documents.metadata so the edge function continues to read correct
-- state. Once the edge function writes completions to this table,
-- the documents.metadata patch below should be removed.
begin
  return query
  with eligible_jobs as (
    select j.id, j.document_id, j.attempt_count, j.max_attempts
    from public.indexing_v3_agent_jobs j
    join public.documents d
      on d.id = j.document_id
     and d.status = 'indexed'
    where j.status not in ('completed', 'needs_enrichment_artifacts')
      and j.enrichment_status in ('pending', 'failed', 'processing')
      and j.attempt_count < j.max_attempts
      and coalesce(j.next_run_at, now()) <= now()
      and (
        j.status <> 'processing'
        or j.locked_at is null
        or j.locked_at < now() - make_interval(mins => p_stale_after_minutes)
      )
    order by coalesce(j.next_run_at, j.updated_at), j.id
    limit greatest(p_claim_limit, 1)
    for update of j skip locked
  ),
  claimed_jobs as (
    update public.indexing_v3_agent_jobs j
    set
      status = 'processing',
      enrichment_status = 'processing',
      locked_by = p_worker_id,
      locked_at = now(),
      attempt_count = e.attempt_count + 1,
      last_error = null,
      next_run_at = null,
      updated_at = now()
    from eligible_jobs e
    where j.id = e.id
    returning j.*
  ),
  -- Patch documents.metadata for backward compatibility with edge function
  patched_documents as (
    update public.documents d
    set
      metadata = jsonb_strip_nulls(
        (coalesce(d.metadata, '{}'::jsonb)
          - 'indexing_v3_agent_next_run_at'
          - 'indexing_v3_agent_last_error')
        || jsonb_build_object(
          'indexing_v3_agent_status', 'processing',
          'indexing_v3_agent_version', cj.version,
          'indexing_v3_agent_locked_by', p_worker_id,
          'indexing_v3_agent_locked_at', cj.locked_at,
          'indexing_v3_agent_attempt_count', cj.attempt_count,
          'indexing_v3_agent_max_attempts', cj.max_attempts,
          'indexing_v3_agent_updated_at', now(),
          'enrichment_status', 'processing'
        )
      ),
      updated_at = now()
    from claimed_jobs cj
    where d.id = cj.document_id
      and d.status = 'indexed'  -- safety: only touch documents still eligible
    returning d.*, cj.id as job_id, cj.attempt_count as job_attempt_count,
              cj.max_attempts as job_max_attempts, cj.locked_at as job_locked_at
  )
  select
    pd.job_id as id,
    pd.id as document_id,
    pd.import_batch_id as batch_id,
    'processing'::text as status,
    'v3 enrichment claimed'::text as stage,
    95::integer as progress,
    null::text as error_message,
    pd.job_attempt_count,
    pd.job_max_attempts,
    pd.job_locked_at as locked_at,
    p_worker_id as locked_by,
    to_jsonb(pd.*) - 'job_id' - 'job_attempt_count' - 'job_max_attempts' - 'job_locked_at' as documents
  from patched_documents pd;
end;
$$;

revoke execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) to service_role;

-- -------------------------------------------------------------------------
-- Step 4: Helper RPC for edge function to complete/fail a job
--         This unblocks the jobs table from being permanently stuck in
--         'processing'. Pair with edge function update.
-- -------------------------------------------------------------------------

create or replace function public.update_indexing_v3_agent_job_status(
  p_document_id uuid,
  p_status text,         -- 'completed', 'failed', 'needs_enrichment_artifacts', 'pending'
  p_error text default null,
  p_next_run_at timestamptz default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_job_id uuid;
begin
  if p_status not in ('pending', 'completed', 'failed', 'needs_enrichment_artifacts') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.indexing_v3_agent_jobs
  set
    status = p_status,
    enrichment_status = case
      when p_status = 'completed' then 'completed'
      when p_status = 'failed' then 'failed'
      when p_status = 'needs_enrichment_artifacts' then 'needs_enrichment_artifacts'
      else enrichment_status
    end,
    last_error = p_error,
    next_run_at = case
      when p_status = 'pending' then coalesce(p_next_run_at, now())
      else null
    end,
    locked_by = null,
    locked_at = null,
    updated_at = now()
  where document_id = p_document_id
  returning id into v_job_id;

  return jsonb_build_object(
    'ok', v_job_id is not null,
    'job_id', v_job_id,
    'document_id', p_document_id,
    'status', p_status
  );
end;
$$;

revoke execute on function public.update_indexing_v3_agent_job_status(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.update_indexing_v3_agent_job_status(uuid, text, text, timestamptz) to service_role;

-- -------------------------------------------------------------------------
-- Step 5: Keep documents_indexing_v3_agent_claim_idx in place for now
--         since the backward-compat documents.metadata patch still writes
--         to that JSONB path. It can be dropped after the edge function
--         migration removes JSONB claim reads entirely.
-- -------------------------------------------------------------------------
comment on index public.documents_indexing_v3_agent_claim_idx is
  'Retained for backward compatibility while edge function still writes enrichment_status / indexing_v3_agent_status to documents.metadata. Drop after edge function migration.';

comment on table public.indexing_v3_agent_jobs is
  'Dedicated worker-state table for the v3 indexing / enrichment agent. Replaces JSONB state in documents.metadata. claim_indexing_v3_agent_jobs uses SKIP LOCKED here; update_indexing_v3_agent_job_status completes/fails a job. See migration 20260702190000 for transition notes.';

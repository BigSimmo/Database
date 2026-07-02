create table if not exists public.ingestion_job_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  stage_name text not null,
  stage_status text not null default 'started'
    check (stage_status in ('started', 'completed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  artifact_counts jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

alter table if exists public.ingestion_job_stages
  drop constraint if exists ingestion_job_stages_job_id_fkey;
delete from public.ingestion_job_stages s
where not exists (
  select 1
  from public.ingestion_jobs j
  where j.id = s.job_id
);
alter table if exists public.ingestion_job_stages
  add constraint ingestion_job_stages_job_id_fkey
  foreign key (job_id) references public.ingestion_jobs(id) on delete cascade;

drop index if exists public.ingestion_job_stages_doc_idx;
create index if not exists ingestion_job_stages_document_started_idx
  on public.ingestion_job_stages(document_id, started_at desc);
create index if not exists ingestion_job_stages_job_stage_started_idx
  on public.ingestion_job_stages(job_id, stage_name, started_at desc);
create index if not exists documents_indexing_v3_agent_claim_idx
  on public.documents(status, ((metadata->>'enrichment_status')), ((metadata->>'indexing_v3_agent_status')), updated_at)
  where status = 'indexed';

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
begin
  return query
  with eligible as (
    select
      d.id,
      d.import_batch_id,
      state.attempt_count,
      state.max_attempts
    from public.documents d
    cross join lateral (
      select
        coalesce(d.metadata->>'enrichment_status', 'pending') as enrichment_status,
        coalesce(d.metadata->>'indexing_v3_agent_status', 'pending') as agent_status,
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
        case
          when coalesce(d.metadata->>'indexing_v3_agent_locked_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            then (d.metadata->>'indexing_v3_agent_locked_at')::timestamptz
          else null
        end as locked_at,
        case
          when coalesce(d.metadata->>'indexing_v3_agent_next_run_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            then (d.metadata->>'indexing_v3_agent_next_run_at')::timestamptz
          else null
        end as next_run_at
    ) state
    where d.status = 'indexed'
      and state.enrichment_status in ('pending', 'failed', 'processing')
      and state.agent_status not in ('completed', 'needs_enrichment_artifacts')
      and state.attempt_count < state.max_attempts
      and coalesce(state.next_run_at, now()) <= now()
      and (
        state.agent_status <> 'processing'
        or state.locked_at is null
        or state.locked_at < now() - make_interval(mins => p_stale_after_minutes)
      )
    order by coalesce(state.next_run_at, d.updated_at), d.id
    limit greatest(p_claim_limit, 1)
    for update of d skip locked
  ),
  claimed as (
    update public.documents d
    set
      metadata = jsonb_strip_nulls(
        (coalesce(d.metadata, '{}'::jsonb)
          - 'indexing_v3_agent_next_run_at'
          - 'indexing_v3_agent_last_error')
        || jsonb_build_object(
          'indexing_v3_agent_status', 'processing',
          'indexing_v3_agent_version', 'visual-core-v3',
          'indexing_v3_agent_locked_by', p_worker_id,
          'indexing_v3_agent_locked_at', now(),
          'indexing_v3_agent_attempt_count', e.attempt_count + 1,
          'indexing_v3_agent_max_attempts', e.max_attempts,
          'indexing_v3_agent_updated_at', now(),
          'enrichment_status', 'processing'
        )
      ),
      updated_at = now()
    from eligible e
    where d.id = e.id
    returning d.*, e.attempt_count + 1 as claimed_attempt_count, e.max_attempts as claimed_max_attempts
  )
  select
    c.id,
    c.id as document_id,
    c.import_batch_id as batch_id,
    'processing'::text as status,
    'v3 enrichment claimed'::text as stage,
    95::integer as progress,
    null::text as error_message,
    c.claimed_attempt_count,
    c.claimed_max_attempts,
    (c.metadata->>'indexing_v3_agent_locked_at')::timestamptz as locked_at,
    c.metadata->>'indexing_v3_agent_locked_by' as locked_by,
    to_jsonb(c.*) - 'claimed_attempt_count' - 'claimed_max_attempts' as documents
  from claimed c;
end;
$$;

revoke execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) to service_role;

grant select, insert, update, delete on table public.ingestion_job_stages to service_role;
alter table public.ingestion_job_stages enable row level security;

drop policy if exists "ingestion job stages service role all" on public.ingestion_job_stages;
create policy "ingestion job stages service role all" on public.ingestion_job_stages
  for all to service_role
  using (true)
  with check (true);

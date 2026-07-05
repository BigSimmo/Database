-- Reconcile live database drift discovered 2026-07-05:
--   1. indexing_v3_agent_jobs table + claim/update RPCs recorded as applied but absent on live
--   2. match_document_embedding_fields_text exists on live with anon/auth execute (codify + lock down)
--   3. rag_visual_eval_* tables exist on live without RLS (codify + enable service_role-only RLS)

set search_path = public, extensions, pg_catalog;

create table if not exists public.indexing_v3_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'needs_enrichment_artifacts')),
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

create unique index if not exists indexing_v3_agent_jobs_document_id_idx
  on public.indexing_v3_agent_jobs(document_id);

create index if not exists indexing_v3_agent_jobs_claim_idx
  on public.indexing_v3_agent_jobs(status, enrichment_status, next_run_at, id)
  where status not in ('completed', 'needs_enrichment_artifacts');

create index if not exists indexing_v3_agent_jobs_locked_at_idx
  on public.indexing_v3_agent_jobs(locked_at)
  where status = 'processing';

alter table public.indexing_v3_agent_jobs enable row level security;

drop policy if exists "indexing v3 agent jobs service role all" on public.indexing_v3_agent_jobs;
create policy "indexing v3 agent jobs service role all"
  on public.indexing_v3_agent_jobs
  for all to service_role
  using (true)
  with check (true);

grant select, insert, update, delete
  on table public.indexing_v3_agent_jobs to service_role;

insert into public.indexing_v3_agent_jobs (
  document_id, status, enrichment_status, attempt_count, max_attempts,
  locked_by, locked_at, next_run_at, version, last_error, metadata, created_at, updated_at
)
select
  d.id,
  case
    when coalesce(d.metadata->>'indexing_v3_agent_status', 'pending') in
         ('completed', 'needs_enrichment_artifacts', 'failed')
      then coalesce(d.metadata->>'indexing_v3_agent_status', 'pending')
    when coalesce(d.metadata->>'indexing_v3_agent_status', 'pending') in ('deferred', 'retry_pending')
      then 'pending'
    when coalesce(d.metadata->>'indexing_v3_agent_status', '') = 'processing'
      and (
        nullif(d.metadata->>'indexing_v3_agent_locked_at', '') is null
        or (d.metadata->>'indexing_v3_agent_locked_at')::timestamptz < now() - interval '2 hours'
      )
      then 'pending'
    else 'pending'
  end,
  coalesce(d.metadata->>'enrichment_status', 'pending'),
  case when coalesce(d.metadata->>'indexing_v3_agent_attempt_count', '') ~ '^[0-9]+$'
    then (d.metadata->>'indexing_v3_agent_attempt_count')::integer else 0 end,
  greatest(case when coalesce(d.metadata->>'indexing_v3_agent_max_attempts', '') ~ '^[0-9]+$'
    then (d.metadata->>'indexing_v3_agent_max_attempts')::integer else 3 end, 1),
  nullif(d.metadata->>'indexing_v3_agent_locked_by', ''),
  case when coalesce(d.metadata->>'indexing_v3_agent_locked_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    then (d.metadata->>'indexing_v3_agent_locked_at')::timestamptz else null end,
  case when coalesce(d.metadata->>'indexing_v3_agent_next_run_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    then (d.metadata->>'indexing_v3_agent_next_run_at')::timestamptz else null end,
  coalesce(nullif(d.metadata->>'indexing_v3_agent_version', ''), 'visual-core-v3'),
  nullif(d.metadata->>'indexing_v3_agent_last_error', ''),
  '{}'::jsonb,
  coalesce(d.created_at, now()),
  coalesce(d.updated_at, now())
from public.documents d
where d.metadata ? 'indexing_v3_agent_status'
on conflict (document_id) do nothing;

create or replace function public.claim_indexing_v3_agent_jobs(
  p_worker_id text,
  p_claim_limit integer default 1,
  p_stale_after_minutes integer default 45
)
returns table (
  id uuid, document_id uuid, batch_id uuid, status text, stage text, progress integer,
  error_message text, attempt_count integer, max_attempts integer, locked_at timestamptz,
  locked_by text, documents jsonb
)
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.indexing_v3_agent_jobs (
    document_id, status, enrichment_status, next_run_at, version, metadata, created_at, updated_at
  )
  select d.id, 'pending', coalesce(d.metadata->>'enrichment_status', 'pending'),
    case when coalesce(d.metadata->>'indexing_v3_agent_next_run_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then (d.metadata->>'indexing_v3_agent_next_run_at')::timestamptz else null end,
    coalesce(nullif(d.metadata->>'indexing_v3_agent_version', ''), 'visual-core-v3'),
    '{}'::jsonb, coalesce(d.created_at, now()), now()
  from public.documents d
  where d.status = 'indexed'
    and d.metadata ? 'indexing_v3_agent_status'
    and coalesce(d.metadata->>'indexing_v3_agent_status', 'pending')
          not in ('completed', 'needs_enrichment_artifacts')
  on conflict (document_id) do nothing;

  return query
  with eligible_jobs as (
    select j.id, j.document_id, j.attempt_count, j.max_attempts
    from public.indexing_v3_agent_jobs j
    join public.documents d on d.id = j.document_id and d.status = 'indexed'
    where j.status not in ('completed', 'needs_enrichment_artifacts')
      and j.enrichment_status in ('pending', 'failed', 'processing')
      and j.attempt_count < j.max_attempts
      and coalesce(j.next_run_at, now()) <= now()
      and (j.status <> 'processing' or j.locked_at is null
        or j.locked_at < now() - make_interval(mins => p_stale_after_minutes))
    order by coalesce(j.next_run_at, j.updated_at), j.id
    limit greatest(p_claim_limit, 1)
    for update of j skip locked
  ),
  claimed_jobs as (
    update public.indexing_v3_agent_jobs j
    set status = 'processing', enrichment_status = 'processing', locked_by = p_worker_id,
      locked_at = now(), attempt_count = e.attempt_count + 1, last_error = null,
      next_run_at = null, updated_at = now()
    from eligible_jobs e where j.id = e.id returning j.*
  ),
  patched_documents as (
    update public.documents d
    set metadata = jsonb_strip_nulls(
        (coalesce(d.metadata, '{}'::jsonb) - 'indexing_v3_agent_next_run_at' - 'indexing_v3_agent_last_error')
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
      ), updated_at = now()
    from claimed_jobs cj
    where d.id = cj.document_id and d.status = 'indexed'
    returning d.*, cj.id as job_id, cj.attempt_count as job_attempt_count,
              cj.max_attempts as job_max_attempts, cj.locked_at as job_locked_at
  )
  select pd.job_id, pd.id, pd.import_batch_id, 'processing'::text, 'v3 enrichment claimed'::text,
    95::integer, null::text, pd.job_attempt_count, pd.job_max_attempts, pd.job_locked_at,
    p_worker_id,
    to_jsonb(pd.*) - 'job_id' - 'job_attempt_count' - 'job_max_attempts' - 'job_locked_at'
  from patched_documents pd;
end;
$$;

revoke execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) to service_role;

create or replace function public.update_indexing_v3_agent_job_status(
  p_document_id uuid, p_status text, p_error text default null, p_next_run_at timestamptz default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare v_job_id uuid;
begin
  if p_status not in ('pending', 'completed', 'failed', 'needs_enrichment_artifacts') then
    raise exception 'invalid status %', p_status;
  end if;
  update public.indexing_v3_agent_jobs
  set status = p_status,
    enrichment_status = case
      when p_status = 'completed' then 'completed'
      when p_status = 'failed' then 'failed'
      when p_status = 'needs_enrichment_artifacts' then 'needs_enrichment_artifacts'
      else enrichment_status end,
    last_error = p_error,
    next_run_at = case when p_status = 'pending' then coalesce(p_next_run_at, now()) else null end,
    locked_by = null, locked_at = null, updated_at = now()
  where document_id = p_document_id
  returning id into v_job_id;
  return jsonb_build_object('ok', v_job_id is not null, 'job_id', v_job_id,
    'document_id', p_document_id, 'status', p_status);
end;
$$;

revoke execute on function public.update_indexing_v3_agent_job_status(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.update_indexing_v3_agent_job_status(uuid, text, text, timestamptz) to service_role;

create or replace function public.match_document_embedding_fields_text(
  query_text text, match_count integer default 16, min_text_rank double precision default 0.0,
  document_filters uuid[] default null, owner_filter uuid default null
)
returns table (
  id uuid, document_id uuid, source_chunk_id uuid, field_type text, content text, text_rank double precision
)
language sql stable set search_path = public, extensions, pg_temp
as $$
  with q as (select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq),
  ranked as (
    select f.id, f.document_id, f.source_chunk_id, f.field_type, f.content,
      ts_rank_cd(f.search_tsv, q.tsq)::double precision as text_rank
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    cross join q
    where f.source_chunk_id is not null
      and (document_filters is null or f.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed' and f.search_tsv @@ q.tsq
  )
  select * from ranked where text_rank >= min_text_rank
  order by text_rank desc, id limit match_count;
$$;

revoke execute on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) to service_role;

create table if not exists public.rag_visual_eval_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  case_name text not null, query text not null,
  expected_unit_types text[] not null default '{}'::text[],
  expected_terms text[] not null default '{}'::text[],
  expected_image_type text, active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rag_visual_eval_cases_doc_idx on public.rag_visual_eval_cases(document_id, active);
create index if not exists rag_visual_eval_cases_owner_id_idx on public.rag_visual_eval_cases(owner_id);

create table if not exists public.rag_visual_eval_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.rag_visual_eval_cases(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  passed boolean not null, top_hit boolean not null, matched_count integer not null default 0,
  hit_payload jsonb not null default '{}'::jsonb, run_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rag_visual_eval_runs_case_id_idx on public.rag_visual_eval_runs(case_id);
create index if not exists rag_visual_eval_runs_document_id_idx on public.rag_visual_eval_runs(document_id);

alter table public.rag_visual_eval_cases enable row level security;
alter table public.rag_visual_eval_runs enable row level security;
drop policy if exists "rag visual eval cases service role all" on public.rag_visual_eval_cases;
create policy "rag visual eval cases service role all" on public.rag_visual_eval_cases for all to service_role using (true) with check (true);
drop policy if exists "rag visual eval runs service role all" on public.rag_visual_eval_runs;
create policy "rag visual eval runs service role all" on public.rag_visual_eval_runs for all to service_role using (true) with check (true);
grant select, insert, update, delete on table public.rag_visual_eval_cases to service_role;
grant select, insert, update, delete on table public.rag_visual_eval_runs to service_role;

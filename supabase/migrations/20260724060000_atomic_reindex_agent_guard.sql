-- Serialize agent enrichment claims with full/retry ingestion reindex requests.
-- The claim path now locks the document row as well as the agent row. The
-- reindex RPC locks that same document before checking the agent lease and
-- creating the ingestion job, so the decision and queue mutation share one
-- transaction and cannot interleave.

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
    and not exists (
      select 1 from public.ingestion_jobs i
      where i.document_id = d.id and i.status in ('pending', 'processing')
    )
    and d.metadata ? 'indexing_v3_agent_status'
    and coalesce(d.metadata->>'indexing_v3_agent_status', 'pending')
          not in ('completed', 'needs_enrichment_artifacts')
  on conflict do nothing;

  return query
  with eligible_jobs as (
    select j.id, j.document_id, j.attempt_count, j.max_attempts
    from public.indexing_v3_agent_jobs j
    join public.documents d on d.id = j.document_id and d.status = 'indexed'
    where j.status not in ('completed', 'needs_enrichment_artifacts')
      and not exists (
        select 1 from public.ingestion_jobs i
        where i.document_id = j.document_id and i.status in ('pending', 'processing')
      )
      and j.enrichment_status in ('pending', 'failed', 'processing')
      and j.attempt_count < j.max_attempts
      and coalesce(j.next_run_at, now()) <= now()
      and (j.status <> 'processing' or j.locked_at is null
        or j.locked_at < now() - make_interval(mins => p_stale_after_minutes))
    order by coalesce(j.next_run_at, j.updated_at), j.id
    limit greatest(p_claim_limit, 1)
    for update of j, d skip locked
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

revoke execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer)
  to service_role;

create or replace function public.request_ingestion_reindex_if_agent_idle(
  p_document_id uuid,
  p_owner_id uuid,
  p_stale_before timestamptz,
  p_max_attempts integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_job public.ingestion_jobs%rowtype;
begin
  if p_document_id is null or p_owner_id is null or p_stale_before is null
     or p_max_attempts is null or p_max_attempts < 1 then
    raise exception 'Reindex identifiers, stale cutoff, and max attempts are required.' using errcode = '22023';
  end if;

  select d.*
    into v_document
  from public.documents d
  where d.id = p_document_id
    and d.owner_id = p_owner_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if exists (
    select 1
    from public.indexing_v3_agent_jobs a
    where a.document_id = p_document_id
      and a.status = 'processing'
      and (
        coalesce(a.locked_at, a.updated_at) is null
        or coalesce(a.locked_at, a.updated_at) > p_stale_before
      )
  ) then
    return jsonb_build_object('outcome', 'agent_enrichment_active');
  end if;

  if exists (
    select 1
    from public.ingestion_jobs i
    where i.document_id = p_document_id
      and i.status in ('pending', 'processing')
  ) then
    return jsonb_build_object('outcome', 'ingestion_active');
  end if;

  begin
    update public.documents
    set status = case when v_document.status = 'indexed' then status else 'queued' end,
        error_message = null,
        page_count = case when v_document.status = 'indexed' then page_count else 0 end,
        chunk_count = case when v_document.status = 'indexed' then chunk_count else 0 end,
        image_count = case when v_document.status = 'indexed' then image_count else 0 end,
        updated_at = now()
    where id = p_document_id
      and owner_id = p_owner_id;

    insert into public.ingestion_jobs (
      document_id,
      batch_id,
      status,
      stage,
      progress,
      max_attempts
    ) values (
      p_document_id,
      v_document.import_batch_id,
      'pending',
      'queued',
      0,
      p_max_attempts
    )
    returning * into v_job;
  exception when unique_violation then
    return jsonb_build_object('outcome', 'ingestion_active');
  end;

  return jsonb_build_object('outcome', 'queued', 'job', to_jsonb(v_job));
end;
$$;

revoke all on function public.request_ingestion_reindex_if_agent_idle(uuid, uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.request_ingestion_reindex_if_agent_idle(uuid, uuid, timestamptz, integer)
  to service_role;

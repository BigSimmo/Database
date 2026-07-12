create or replace function public.request_indexing_v3_enrichment(
  p_document_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job_id uuid;
begin
  perform 1
  from public.documents
  where id = p_document_id and owner_id = p_owner_id and status = 'indexed'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'document_not_available_for_enrichment';
  end if;

  if exists (
    select 1 from public.ingestion_jobs
    where document_id = p_document_id and status in ('pending', 'processing')
  ) then
    raise exception using errcode = 'P0001', message = 'ingestion_active';
  end if;

  update public.indexing_v3_agent_jobs
  set status = 'pending',
      enrichment_status = 'pending',
      attempt_count = 0,
      locked_by = null,
      locked_at = null,
      next_run_at = null,
      last_error = null,
      updated_at = now()
  where document_id = p_document_id
    and status <> 'processing'
  returning id into v_job_id;

  if v_job_id is null then
    if exists (
      select 1 from public.indexing_v3_agent_jobs
      where document_id = p_document_id and status = 'processing'
    ) then
      raise exception using errcode = 'P0001', message = 'enrichment_active';
    end if;
    insert into public.indexing_v3_agent_jobs (
      document_id, status, enrichment_status, attempt_count, max_attempts, version, metadata
    ) values (
      p_document_id, 'pending', 'pending', 0, 3, 'visual-core-v3', '{}'::jsonb
    )
    returning id into v_job_id;
  end if;

  update public.documents
  set metadata = (coalesce(metadata, '{}'::jsonb)
      - 'indexing_v3_agent_locked_by' - 'indexing_v3_agent_locked_at'
      - 'indexing_v3_agent_last_error' - 'indexing_v3_agent_next_run_at')
      || jsonb_build_object(
        'enrichment_status', 'pending',
        'indexing_v3_agent_status', 'pending',
        'indexing_v3_agent_updated_at', now()
      ),
      updated_at = now()
  where id = p_document_id and owner_id = p_owner_id;

  return jsonb_build_object('ok', true, 'job_id', v_job_id);
end;
$$;

revoke execute on function public.request_indexing_v3_enrichment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_indexing_v3_enrichment(uuid, uuid) to service_role;

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
  on conflict (document_id) do nothing;

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

revoke execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer)
  to service_role;


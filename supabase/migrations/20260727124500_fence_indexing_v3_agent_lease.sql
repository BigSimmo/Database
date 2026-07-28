-- Additive v2 lease fences for the indexing-v3 Edge agent. Apply this migration
-- before deploying the Edge source that calls these functions. V1 remains for
-- one rollout so an already-running invocation is not broken mid-deploy.

create or replace function public.update_indexing_v3_agent_job_status_v2(
  p_document_id uuid,
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_error text default null,
  p_next_run_at timestamptz default null,
  p_document_metadata_patch jsonb default '{}'::jsonb,
  p_release_unstarted boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_job public.indexing_v3_agent_jobs%rowtype;
  v_attempt_count integer;
begin
  if p_document_id is null or p_job_id is null or p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception using errcode = '22023', message = 'document_id, job_id, and worker_id are required';
  end if;
  if p_status not in ('pending', 'completed', 'failed', 'needs_enrichment_artifacts') then
    raise exception using errcode = '22023', message = format('invalid status %s', p_status);
  end if;
  if p_release_unstarted and p_status <> 'pending' then
    raise exception using errcode = '22023', message = 'unstarted claims can only be released to pending';
  end if;

  select * into v_job
  from public.indexing_v3_agent_jobs as job
  where job.id = p_job_id and job.document_id = p_document_id
  for update;

  if not found
     or v_job.status is distinct from 'processing'
     or v_job.locked_by is distinct from p_worker_id
     or v_job.locked_at is null then
    return jsonb_build_object(
      'ok', false,
      'gate_passed', false,
      'missing', jsonb_build_array('lease_lost'),
      'reason', 'lease_lost',
      'status', 'lease_lost',
      'job_id', p_job_id,
      'document_id', p_document_id
    );
  end if;

  v_attempt_count := greatest(v_job.attempt_count - case when p_release_unstarted then 1 else 0 end, 0);

  update public.indexing_v3_agent_jobs
  set
    status = p_status,
    enrichment_status = p_status,
    attempt_count = v_attempt_count,
    last_error = p_error,
    next_run_at = case when p_status = 'pending' then coalesce(p_next_run_at, now()) else null end,
    locked_by = null,
    locked_at = null,
    updated_at = now()
  where id = p_job_id;

  update public.documents as document
  set
    metadata = public.jsonb_merge_deep(
      coalesce(document.metadata, '{}'::jsonb),
      jsonb_build_object(
        'indexing_v3_agent_status', p_status,
        'indexing_v3_agent_updated_at', now(),
        'indexing_v3_agent_attempt_count', v_attempt_count,
        'indexing_v3_agent_locked_by', null,
        'indexing_v3_agent_locked_at', null,
        'indexing_v3_agent_next_run_at', case when p_status = 'pending' then coalesce(p_next_run_at, now()) else null end,
        'indexing_v3_agent_last_error', p_error,
        'enrichment_status', p_status,
        'enrichment_error', p_error
      ) || coalesce(p_document_metadata_patch, '{}'::jsonb)
    ),
    updated_at = now()
  where document.id = p_document_id;

  return jsonb_build_object(
    'ok', true,
    'gate_passed', false,
    'missing', '[]'::jsonb,
    'reason', case when p_release_unstarted then 'released_unstarted' else 'updated' end,
    'status', p_status,
    'job_id', p_job_id,
    'document_id', p_document_id,
    'attempt_count', v_attempt_count
  );
end;
$$;

revoke execute on function public.update_indexing_v3_agent_job_status_v2(
  uuid, uuid, text, text, text, timestamptz, jsonb, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.update_indexing_v3_agent_job_status_v2(
  uuid, uuid, text, text, text, timestamptz, jsonb, boolean
) to service_role;

create or replace function public.complete_strict_enrichment_job_v2(
  p_document_id uuid,
  p_job_id uuid,
  p_worker_id text,
  p_stage text default 'indexed; enrichment completed',
  p_agent_version text default 'visual-core-v3',
  p_visual_indexing_version text default 'visual-v3'
)
returns table (
  ok boolean,
  document_id uuid,
  gate_passed boolean,
  missing text[],
  status text,
  counts jsonb,
  presence jsonb,
  completed_job_ids uuid[]
)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_job public.indexing_v3_agent_jobs%rowtype;
  v_completion record;
begin
  select * into v_job
  from public.indexing_v3_agent_jobs as job
  where job.id = p_job_id and job.document_id = p_document_id
  for update;

  if not found
     or v_job.status is distinct from 'processing'
     or v_job.locked_by is distinct from p_worker_id
     or v_job.locked_at is null then
    return query select
      false,
      p_document_id,
      false,
      array['lease_lost']::text[],
      'lease_lost'::text,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::uuid[];
    return;
  end if;

  select * into v_completion
  from public.complete_strict_enrichment_job(
    p_document_id,
    p_job_id,
    p_stage,
    p_agent_version,
    p_visual_indexing_version
  );

  if not found then
    return query select
      false,
      p_document_id,
      false,
      array['completion_rpc_failed']::text[],
      'completion_rpc_failed'::text,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::uuid[];
    return;
  end if;

  if v_completion.ok then
    update public.indexing_v3_agent_jobs
    set
      status = 'completed',
      enrichment_status = 'completed',
      last_error = null,
      next_run_at = null,
      locked_by = null,
      locked_at = null,
      updated_at = now()
    where id = p_job_id;
  end if;

  return query select
    v_completion.ok,
    v_completion.document_id,
    v_completion.gate_passed,
    v_completion.missing,
    v_completion.status,
    v_completion.counts,
    v_completion.presence,
    case when v_completion.ok then array[p_job_id]::uuid[] else '{}'::uuid[] end;
end;
$$;

revoke execute on function public.complete_strict_enrichment_job_v2(uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_strict_enrichment_job_v2(uuid, uuid, text, text, text, text)
  to service_role;

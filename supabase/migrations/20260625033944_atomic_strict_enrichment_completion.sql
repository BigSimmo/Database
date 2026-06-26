create or replace function public.complete_strict_enrichment_job(
  p_document_id uuid,
  p_job_id uuid default null,
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
  gate_row record;
begin
  perform 1
  from public.documents d
  where d.id = p_document_id
  for update;

  if not found then
    return query
    select
      false,
      p_document_id,
      false,
      array['document_not_found']::text[],
      'missing_document',
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::uuid[];
    return;
  end if;

  select *
  into gate_row
  from public.document_strict_gate_status g
  where g.document_id = p_document_id;

  if not found then
    return query
    select
      false,
      p_document_id,
      false,
      array['strict_gate_status_missing']::text[],
      'blocked_missing_artifacts',
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::uuid[];
    return;
  end if;

  if not gate_row.gate_passed then
    return query
    select
      false,
      p_document_id,
      false,
      gate_row.missing,
      'blocked_missing_artifacts',
      gate_row.counts,
      gate_row.presence,
      '{}'::uuid[];
    return;
  end if;

  update public.documents d
  set
    metadata = jsonb_strip_nulls(
      (coalesce(d.metadata, '{}'::jsonb)
        - 'indexing_v3_agent_locked_by'
        - 'indexing_v3_agent_locked_at'
        - 'indexing_v3_agent_next_run_at'
        - 'indexing_v3_agent_last_error'
        - 'completion_gate_missing')
      || jsonb_build_object(
        'indexing_v3_agent_status', 'completed',
        'indexing_v3_agent_version', p_agent_version,
        'indexing_v3_agent_updated_at', now(),
        'indexing_v3_agent_deferral_count', 0,
        'visual_indexing_version', p_visual_indexing_version,
        'completion_gate', jsonb_build_object(
          'result', 'complete',
          'missing', to_jsonb(gate_row.missing),
          'counts', gate_row.counts,
          'presence', gate_row.presence,
          'source', 'complete_strict_enrichment_job'
        ),
        'enrichment_status', 'completed'
      )
    ),
    updated_at = now()
  where d.id = p_document_id;

  insert into public.document_index_quality (
    document_id,
    owner_id,
    quality_score,
    extraction_quality,
    metrics,
    issues,
    updated_at
  )
  values (
    p_document_id,
    gate_row.owner_id,
    greatest(coalesce(gate_row.quality_score, 0), 1)::real,
    'good',
    jsonb_build_object(
      'strict_enrichment_gate', jsonb_build_object(
        'result', 'complete',
        'counts', gate_row.counts,
        'presence', gate_row.presence,
        'source', 'complete_strict_enrichment_job'
      )
    ),
    '{}'::text[],
    now()
  )
  on conflict on constraint document_index_quality_pkey
  do update set
    quality_score = greatest(public.document_index_quality.quality_score, excluded.quality_score),
    extraction_quality = 'good',
    metrics = coalesce(public.document_index_quality.metrics, '{}'::jsonb) || excluded.metrics,
    issues = '{}'::text[],
    updated_at = now();

  return query
  select
    true,
    p_document_id,
    true,
    gate_row.missing,
    'completed',
    gate_row.counts,
    gate_row.presence,
    '{}'::uuid[];
end;
$$;

revoke execute on function public.complete_strict_enrichment_job(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_strict_enrichment_job(uuid, uuid, text, text, text) to service_role;

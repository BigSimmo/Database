-- Recover terminal and exhausted enrichment jobs without cancelling queued work.
-- Installing these functions does not invoke repair or queue provider work.
-- Operator apply can queue full re-ingestion; it remains a separate explicit decision.
set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Shared read-only selection for preview and repair. Both use the same order and limit.
-- Pending ingestion work is valid regardless of its age. Agent pending work is valid
-- while it still has attempts. Fresh processing leases exclude the entire document,
-- including its metadata, rather than only excluding a job-row update.
create or replace function public.preview_strict_enrichment_gate_repair(p_limit integer default 50)
returns setof public.document_strict_gate_status
language sql
stable
security invoker
set search_path = ''
as $preview$
  select g.*
  from public.document_strict_gate_status g
  left join public.indexing_v3_agent_jobs a on a.document_id = g.document_id
  where g.document_status = 'indexed'
    and not exists (
      select 1 from public.ingestion_jobs j
      where j.document_id = g.document_id
        and (
          j.status = 'pending'
          or (j.status = 'processing' and j.locked_at >= now() - interval '45 minutes')
        )
    )
    and not (
      coalesce(a.status = 'pending' and a.attempt_count < a.max_attempts, false)
      or coalesce(a.status = 'processing' and a.locked_at >= now() - interval '45 minutes', false)
    )
    and (
      (g.gate_passed and (
        coalesce(g.enrichment_status, '') <> 'completed'
        or coalesce(g.indexing_v3_agent_status, '') <> 'completed'
        or coalesce(g.quality_extraction_quality, '') <> 'good'
        or (a.id is not null and (a.status <> 'completed' or a.enrichment_status <> 'completed'))
        or exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = g.document_id and j.status = 'processing'
        )
      ))
      or (not g.gate_passed and (
        coalesce(g.enrichment_status, '') = 'completed'
        or coalesce(g.indexing_v3_agent_status, '') = 'completed'
        or a.status in ('failed', 'needs_enrichment_artifacts')
        or a.attempt_count >= a.max_attempts
      ))
    )
  order by g.document_updated_at asc nulls first, g.document_id
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$preview$;
revoke execute on function public.preview_strict_enrichment_gate_repair(integer) from public, anon, authenticated;
grant execute on function public.preview_strict_enrichment_gate_repair(integer) to service_role;

CREATE OR REPLACE FUNCTION public.repair_strict_enrichment_gate_batch(p_limit integer DEFAULT 50)
 RETURNS TABLE(document_id uuid, missing text[], repaired text[], status text, counts jsonb, presence jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  return query
  with candidates as materialized (
    select g.*
    from public.preview_strict_enrichment_gate_repair(p_limit) g
    join public.documents d on d.id = g.document_id
    -- Claims and reindex requests lock the same document. Skip a concurrent owner.
    for update of d skip locked
  ),
  updated_documents as (
    update public.documents d
    set
      metadata = case
        when c.gate_passed then
          jsonb_strip_nulls(
            (coalesce(d.metadata, '{}'::jsonb)
              - 'indexing_v3_agent_locked_by'
              - 'indexing_v3_agent_locked_at'
              - 'indexing_v3_agent_next_run_at'
              - 'indexing_v3_agent_last_error'
              - 'completion_gate_missing')
            || jsonb_build_object(
              'indexing_v3_agent_status', 'completed',
              'indexing_v3_agent_updated_at', now(),
              'indexing_v3_agent_deferral_count', 0,
              'completion_gate', jsonb_build_object(
                'result', 'complete',
                'missing', to_jsonb(c.missing),
                'counts', c.counts,
                'presence', c.presence,
                'source', 'repair_strict_enrichment_gate_batch'
              ),
              'enrichment_status', 'completed'
            )
          )
        else
          jsonb_strip_nulls(
            (coalesce(d.metadata, '{}'::jsonb)
              - 'indexing_v3_agent_locked_by'
              - 'indexing_v3_agent_locked_at'
              - 'indexing_v3_agent_next_run_at'
              - 'indexing_v3_agent_last_error')
            || jsonb_build_object(
              'indexing_v3_agent_status', 'deferred',
              'indexing_v3_agent_deferral_count', 0,
              'indexing_v3_agent_updated_at', now(),
              'completion_gate_missing', to_jsonb(c.missing),
              'completion_gate', jsonb_build_object(
                'result', 'deferred',
                'missing', to_jsonb(c.missing),
                'counts', c.counts,
                'presence', c.presence,
                'source', 'repair_strict_enrichment_gate_batch'
              ),
              'enrichment_status', 'pending'
            )
          )
      end,
      updated_at = now()
    from candidates c
    where d.id = c.document_id
    returning d.id
  ),
  quality_promotions as (
    insert into public.document_index_quality (
      document_id,
      owner_id,
      quality_score,
      extraction_quality,
      metrics,
      issues,
      updated_at
    )
    select
      c.document_id,
      c.owner_id,
      greatest(c.quality_score, 1)::real,
      'good',
      jsonb_build_object(
        'strict_enrichment_gate', jsonb_build_object(
          'result', 'complete',
          'counts', c.counts,
          'presence', c.presence,
          'source', 'repair_strict_enrichment_gate_batch'
        )
      ),
      '{}'::text[],
      now()
    from candidates c
    where c.gate_passed
    on conflict on constraint document_index_quality_pkey
    do update set
      quality_score = greatest(public.document_index_quality.quality_score, excluded.quality_score),
      extraction_quality = 'good',
      metrics = coalesce(public.document_index_quality.metrics, '{}'::jsonb) || excluded.metrics,
      updated_at = now()
    returning public.document_index_quality.document_id
  ),
  completed_open_jobs as (
    update public.ingestion_jobs j
    set
      status = 'completed',
      stage = 'indexed',
      progress = 100,
      error_message = null,
      locked_at = null,
      locked_by = null,
      completed_at = coalesce(j.completed_at, now()),
      updated_at = now()
    from candidates c
    where c.gate_passed
      and j.document_id = c.document_id
      and j.status = 'processing'
      and not (
        j.status = 'processing'
        and j.locked_at is not null
        and j.locked_at >= now() - make_interval(mins => 45)
      )
    returning j.document_id
  ),
  deferred_open_jobs as (
    update public.ingestion_jobs j
    set
      status = 'pending',
      stage = 'strict_gate_deferred',
      progress = least(j.progress, 95),
      error_message = 'strict enrichment gate missing: ' || array_to_string(c.missing, ','),
      locked_at = null,
      locked_by = null,
      next_run_at = now(),
      completed_at = null,
      updated_at = now()
    from candidates c
    where not c.gate_passed
      and j.document_id = c.document_id
      and j.status = 'processing'
      and not (
        j.status = 'processing'
        and j.locked_at is not null
        and j.locked_at >= now() - make_interval(mins => 45)
      )
    returning j.document_id
  ),
  queued_repair_jobs as (
    insert into public.ingestion_jobs (
      document_id,
      status,
      stage,
      progress,
      error_message,
      next_run_at
    )
    select
      c.document_id,
      'pending',
      'strict_gate_repair',
      95,
      'strict enrichment gate missing: ' || array_to_string(c.missing, ','),
      now()
    from candidates c
    where not c.gate_passed
      and not exists (
        select 1
        from public.ingestion_jobs j
        where j.document_id = c.document_id
          and j.status in ('pending', 'processing')
      )
    returning public.ingestion_jobs.document_id
  ),
  -- Reset terminal/exhausted jobs only after shared candidate and lease checks.
  reset_agent_jobs as (
    update public.indexing_v3_agent_jobs a
    set
      status = case when c.gate_passed then 'completed' else 'pending' end,
      enrichment_status = case when c.gate_passed then 'completed' else 'pending' end,
      attempt_count = case when c.gate_passed then a.attempt_count else 0 end,
      locked_by = null,
      locked_at = null,
      next_run_at = case when c.gate_passed then null else now() end,
      last_error = case
        when c.gate_passed then null
        else 'strict enrichment gate missing: ' || array_to_string(c.missing, ',')
      end,
      metadata = coalesce(a.metadata, '{}'::jsonb) || jsonb_build_object(
        'strict_gate_repair', jsonb_build_object(
          'at', now(),
          'gate_passed', c.gate_passed,
          'missing', to_jsonb(c.missing),
          'previous_status', a.status,
          'previous_attempt_count', a.attempt_count,
          'count', coalesce((a.metadata->'strict_gate_repair'->>'count')::integer, 0) + 1
        )
      ),
      updated_at = now()
    from candidates c
    where a.document_id = c.document_id
      and not (
        a.status = 'processing'
        and a.locked_at is not null
        and a.locked_at >= now() - make_interval(mins => 45)
      )
      and not (
        a.status = 'pending'
        and a.attempt_count < a.max_attempts
      )
      and (
        c.gate_passed
        or a.status in ('failed', 'needs_enrichment_artifacts')
        or a.attempt_count >= a.max_attempts
      )
    returning a.document_id
  )
  select
    c.document_id,
    c.missing,
    array_remove(array[
      case when c.gate_passed then 'metadata_completed' else 'metadata_deferred' end,
      case when c.gate_passed then 'quality_good' else null end,
      case when exists (select 1 from completed_open_jobs j where j.document_id = c.document_id) then 'open_jobs_completed' else null end,
      case when exists (select 1 from deferred_open_jobs j where j.document_id = c.document_id) then 'open_jobs_deferred' else null end,
      case when exists (select 1 from queued_repair_jobs j where j.document_id = c.document_id) then 'repair_job_queued' else null end,
      case when exists (select 1 from reset_agent_jobs j where j.document_id = c.document_id) then 'agent_job_reset' else null end
    ], null)::text[] as repaired,
    case when c.gate_passed then 'completed' else 'deferred' end as status,
    c.counts,
    c.presence
  from candidates c
  where exists (select 1 from updated_documents u where u.id = c.document_id)
  order by c.document_updated_at asc nulls first, c.document_id;
end;
$function$;
revoke execute on function public.repair_strict_enrichment_gate_batch(integer) from public, anon, authenticated;
grant execute on function public.repair_strict_enrichment_gate_batch(integer) to service_role;

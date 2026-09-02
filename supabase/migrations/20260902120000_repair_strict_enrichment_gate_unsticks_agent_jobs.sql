-- Let repair_strict_enrichment_gate_batch actually unstick a document (#W98GR7).
--
-- The function reconciles documents.metadata, document_index_quality and ingestion_jobs. It
-- does not touch public.indexing_v3_agent_jobs, which is the table
-- claim_indexing_v3_agent_jobs reads: 20260724060000 excludes 'needs_enrichment_artifacts'
-- by name and excludes 'failed' through `attempt_count < max_attempts`, and nothing in the
-- codebase resets either. A document that exhausted its attempts or reached the terminal
-- deferral state is therefore unclaimable forever, and the repair function -- the one piece
-- of machinery designed to recover it -- could not, even if something had called it. Nothing
-- did: a repo-wide search for the function name finds the migration, the schema mirror,
-- generated types, docs and a schema-text assertion, and no invocation at all.
--
-- BASELINE. This is a delta on the body currently deployed, which is the one codified by
-- 20260712171500_codify_live_ahead_functions.sql and mirrored at supabase/schema.sql's
-- LATER (uppercase) copy -- NOT the original 20260625033425 body, which schema.sql still
-- carries earlier in the file as a superseded copy. Those two differ by more than
-- whitespace: the original declares v_processing_lock_timeout and keeps a processing row's
-- metadata when its lock is fresh, and the deployed one does neither. Rebuilding from the
-- wrong copy would have shipped that difference as an undeclared second behaviour change and
-- moved the def_hash 20260819110500 pins for reasons unrelated to this issue.
--
-- The only changes here are the reset_agent_jobs CTE and the 'agent_job_reset' element it
-- adds to the returned `repaired` array. Everything else is byte-identical to the deployed
-- body.
--
-- The deployed body has no lease-age guard anywhere, so the new CTE carries its own: a row
-- the agent currently holds is left alone. Without it the gate_passed disjunct would match a
-- document mid-run -- gate_passed is a structural fact about the artifacts present, and
-- request_indexing_v3_enrichment re-queues a document without clearing them, so it stays
-- true for the whole of the new run -- and clearing status/locked_by/locked_at underneath
-- that run would make request_ingestion_reindex_if_agent_idle read the agent as idle and
-- approve a concurrent reindex over the same artifact tables.
--
-- Applying this changes no behaviour on its own: the function is invoked by nothing
-- automatically, and the operator script added alongside it is dry-run by default.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.repair_strict_enrichment_gate_batch(p_limit integer DEFAULT 50)
 RETURNS TABLE(document_id uuid, missing text[], repaired text[], status text, counts jsonb, presence jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  return query
  with candidates as (
    select g.*
    from public.document_strict_gate_status g
    where g.document_status = 'indexed'
      and (
        (
          g.gate_passed
          and (
            coalesce(g.enrichment_status, '') <> 'completed'
            or coalesce(g.indexing_v3_agent_status, '') <> 'completed'
            or coalesce(g.quality_extraction_quality, '') <> 'good'
            or exists (
              select 1
              from public.ingestion_jobs j
              where j.document_id = g.document_id
                and j.status in ('pending', 'processing')
            )
          )
        )
        or (
          not g.gate_passed
          and (
            coalesce(g.enrichment_status, '') = 'completed'
            or coalesce(g.indexing_v3_agent_status, '') = 'completed'
          )
        )
      )
    order by g.document_updated_at asc nulls first, g.document_id
    limit greatest(1, least(coalesce(p_limit, 50), 500))
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
    on conflict (document_id)
    do update set
      quality_score = greatest(public.document_index_quality.quality_score, excluded.quality_score),
      extraction_quality = 'good',
      metrics = coalesce(public.document_index_quality.metrics, '{}'::jsonb) || excluded.metrics,
      updated_at = now()
    returning document_id
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
      and j.status in ('pending', 'processing')
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
      and j.status in ('pending', 'processing')
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
    returning document_id
  ),
  -- The half this function was missing (#W98GR7). Everything above reconciles
  -- documents.metadata, document_index_quality and ingestion_jobs. None of it touches
  -- indexing_v3_agent_jobs, which is the table claim_indexing_v3_agent_jobs actually reads:
  -- that RPC excludes 'needs_enrichment_artifacts' by name and excludes 'failed' via
  -- `attempt_count < max_attempts`, and nothing anywhere resets either. So a document could
  -- be "repaired" into a completed metadata state while remaining permanently unclaimable,
  -- or be re-queued for enrichment that the agent could never pick up.
  --
  -- gate_passed: the artifacts are present, so the row is completed, not retried.
  -- not gate_passed: the row goes back to claimable with a fresh attempt budget. That reset
  -- is deliberate and only ever happens under an explicit operator run; the deferral budget
  -- (INDEXING_V3_MAX_DEFERRALS, default 6) still bounds the agent's own retries, and each
  -- repair stamps a counter so a document being repaired again and again is visible rather
  -- than looping silently.
  --
  -- A row the agent currently holds is left alone: `locked_at` within the lease window is
  -- excluded, so a repair cannot pull the lease out from under a live claim.
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

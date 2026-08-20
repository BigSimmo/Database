-- Phase 4 Batch A (plan section 4.1): record the already-completed restoration of the
-- fourteen repo-defined operational indexes that live-drift reported as missing_live
-- (forensics section 1.3, 2026-08-14; still absent at the 2026-08-19 window pre-flight).
--
-- Every definition below is the canonical one already carried by supabase/schema.sql and by
-- the migration that first created it, so this migration adds no schema and schema.sql needs
-- no mirror change. Like 20260804110240 it VALIDATES and never builds: a plain CREATE INDEX
-- here would hold write-blocking locks, and CREATE INDEX CONCURRENTLY cannot run inside the
-- per-migration transaction that supabase db push uses. A drifted hosted target must prebuild
-- each index with CREATE INDEX CONCURRENTLY outside any transaction, validate pg_index
-- indisvalid/indisready plus the canonical definition, and only then apply this version.
-- This guard fails fast if that operator step was skipped.
--
-- Timeouts use SET LOCAL so they do not leak into later migrations applied on the same CLI
-- session connection (plain SET is session-scoped).
--
-- Name resolution is canonical-only: none of these fourteen has an entry in
-- search_schema_health()'s index_aliases map. If an alias is ever added for one of them,
-- update this guard before relying on the health probe as evidence of repair.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  missing_indexes text[] := array[]::text[];
  invalid_indexes text[] := array[]::text[];
  mismatched_indexes text[] := array[]::text[];
  required record;
  index_oid regclass;
  is_valid boolean;
  is_ready boolean;
  actual_def text;
  actual_normalized text;
  expected_normalized text;
begin
  for required in
    select *
    from (
      values
        (
          'audit_logs_action_created_idx',
          'create index audit_logs_action_created_idx on public.audit_logs using btree (action, created_at desc)'
        ),
        (
          'audit_logs_owner_created_idx',
          'create index audit_logs_owner_created_idx on public.audit_logs using btree (owner_id, created_at desc)'
        ),
        (
          'api_rate_limits_bucket_updated_idx',
          'create index api_rate_limits_bucket_updated_idx on public.api_rate_limits using btree (bucket, updated_at desc)'
        ),
        (
          'rag_aliases_type_enabled_idx',
          'create index rag_aliases_type_enabled_idx on public.rag_aliases using btree (alias_type, enabled)'
        ),
        (
          'rag_queries_source_chunk_ids_gin_idx',
          'create index rag_queries_source_chunk_ids_gin_idx on public.rag_queries using gin (source_chunk_ids)'
        ),
        (
          'rag_query_misses_aliases_idx',
          'create index rag_query_misses_aliases_idx on public.rag_query_misses using gin (candidate_aliases)'
        ),
        (
          'image_caption_cache_owner_hash_idx',
          'create index image_caption_cache_owner_hash_idx on public.image_caption_cache using btree (owner_id, image_hash, model)'
        ),
        (
          'document_index_quality_owner_score_idx',
          'create index document_index_quality_owner_score_idx on public.document_index_quality using btree (owner_id, quality_score, updated_at desc)'
        ),
        (
          'document_publication_approvals_document_idx',
          'create index document_publication_approvals_document_idx on public.document_publication_approvals using btree (document_id, approved_at desc)'
        ),
        (
          'document_summaries_owner_idx',
          'create index document_summaries_owner_idx on public.document_summaries using btree (owner_id, generated_at desc)'
        ),
        (
          'indexing_v3_agent_jobs_locked_at_idx',
          'create index indexing_v3_agent_jobs_locked_at_idx on public.indexing_v3_agent_jobs using btree (locked_at) where (status = ''processing''::text)'
        ),
        (
          'ingestion_job_stages_job_stage_started_idx',
          'create index ingestion_job_stages_job_stage_started_idx on public.ingestion_job_stages using btree (job_id, stage_name, started_at desc)'
        ),
        (
          'medication_records_owner_category_idx',
          'create index medication_records_owner_category_idx on public.medication_records using btree (owner_id, category)'
        ),
        (
          'storage_cleanup_jobs_owner_status_idx',
          'create index storage_cleanup_jobs_owner_status_idx on public.storage_cleanup_jobs using btree (owner_id, status, created_at desc)'
        )
    ) as t(index_name, canonical_def)
  loop
    index_oid := to_regclass(format('public.%I', required.index_name));
    if index_oid is null then
      missing_indexes := array_append(missing_indexes, required.index_name);
      continue;
    end if;

    select i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid)
      into is_valid, is_ready, actual_def
    from pg_index as i
    where i.indexrelid = index_oid;

    if not coalesce(is_valid, false) or not coalesce(is_ready, false) then
      invalid_indexes := array_append(invalid_indexes, required.index_name);
      continue;
    end if;

    -- Keep in lockstep with normalizeIndexDefinition in tests/supabase-schema.test.ts.
    actual_normalized := lower(actual_def);
    actual_normalized := replace(actual_normalized, 'create index if not exists', 'create index');
    actual_normalized := regexp_replace(actual_normalized, ' extensions\.', ' ', 'g');
    actual_normalized := regexp_replace(actual_normalized, ' using btree', '', 'g');
    actual_normalized := regexp_replace(actual_normalized, 'where \(([^()]*)\)$', 'where \1');
    actual_normalized := replace(actual_normalized, ';', '');
    actual_normalized := regexp_replace(actual_normalized, '[[:space:]]+', ' ', 'g');
    actual_normalized := regexp_replace(actual_normalized, ' on ([^ ()]+) \(', ' on \1(', 'g');
    actual_normalized := btrim(actual_normalized);

    expected_normalized := lower(required.canonical_def);
    expected_normalized := replace(expected_normalized, 'create index if not exists', 'create index');
    expected_normalized := regexp_replace(expected_normalized, ' extensions\.', ' ', 'g');
    expected_normalized := regexp_replace(expected_normalized, ' using btree', '', 'g');
    expected_normalized := regexp_replace(expected_normalized, 'where \(([^()]*)\)$', 'where \1');
    expected_normalized := replace(expected_normalized, ';', '');
    expected_normalized := regexp_replace(expected_normalized, '[[:space:]]+', ' ', 'g');
    expected_normalized := regexp_replace(expected_normalized, ' on ([^ ()]+) \(', ' on \1(', 'g');
    expected_normalized := btrim(expected_normalized);

    if actual_normalized is distinct from expected_normalized then
      mismatched_indexes := array_append(mismatched_indexes, required.index_name);
    end if;
  end loop;

  if cardinality(missing_indexes) > 0
     or cardinality(invalid_indexes) > 0
     or cardinality(mismatched_indexes) > 0 then
    raise exception
      'Phase 4 Batch A operational indexes were not prebuilt; create the missing indexes concurrently outside the migration transaction, validate them, then apply this version. Missing: %; Invalid: %; Mismatched: %',
      coalesce(nullif(array_to_string(missing_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(invalid_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_indexes, ', '), ''), '(none)');
  end if;
end
$migration$;

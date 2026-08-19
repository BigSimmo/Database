-- Phase 6.2 history guard (plan section 6.2; forensics section 1.1 / 3.7 / '6.2 completion'):
-- validate the forty-six operational indexes created by three hand-applied, mark-applied versions.
-- Ledger anchor #Q5JHBJ (#316 umbrella).
--
--   20260702150000 documents_owner_covering_index   -> documents_owner_id_covering_idx (1)
--   20260712165915 reconcile_ingestion_index_shapes -> import_batches_status_created_idx,
--                                                      ingestion_jobs_document_status_idx,
--                                                      ingestion_jobs_status_next_run_idx (3)
--   20260712170500 codify_live_operational_indexes  -> the 42 of its 44 `create index if not exists`
--       statements that persist; document_table_facts_document_id_idx and document_table_facts_owner_idx
--       were dropped again by 20260712172000 and are proven ABSENT by 20260819110000 instead.
--
-- Every canonical definition below is the rendered pg_get_indexdef that supabase/drift-manifest.json
-- pins for the index (snapshot.indexes[].def) -- the same text production and staging were measured
-- against when live-drift reported zero index findings (run 32171070287 and the staging comparison).
--
-- Like 20260804110240 this migration VALIDATES and never builds: presence via to_regclass,
-- pg_index.indisvalid AND indisready, and the normalised pg_get_indexdef against the pinned definition
-- (normaliser kept in lockstep with normalizeIndexDefinition in tests/supabase-schema.test.ts). A drifted
-- hosted target must prebuild any missing index with CREATE INDEX CONCURRENTLY outside the migration
-- transaction, validate it, and only then apply this version. Timeouts use SET LOCAL.
--
-- Name resolution is canonical-only: none of these has an entry in search_schema_health()'s
-- index_aliases map, so an alias is never accepted as evidence.

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
        -- 20260702150000
        (
          'documents_owner_id_covering_idx',
          'CREATE INDEX documents_owner_id_covering_idx ON public.documents USING btree (owner_id, id)'
        ),
        -- 20260712165915
        (
          'import_batches_status_created_idx',
          'CREATE INDEX import_batches_status_created_idx ON public.import_batches USING btree (status, created_at DESC) WHERE (status = ANY (ARRAY[''queued''::text, ''processing''::text]))'
        ),
        -- 20260712165915
        (
          'ingestion_jobs_document_status_idx',
          'CREATE INDEX ingestion_jobs_document_status_idx ON public.ingestion_jobs USING btree (document_id, status, created_at)'
        ),
        -- 20260712165915
        (
          'ingestion_jobs_status_next_run_idx',
          'CREATE INDEX ingestion_jobs_status_next_run_idx ON public.ingestion_jobs USING btree (status, next_run_at, created_at) WHERE (status = ANY (ARRAY[''pending''::text, ''processing''::text, ''failed''::text]))'
        ),
        -- 20260712170500
        (
          'audit_logs_owner_id_idx',
          'CREATE INDEX audit_logs_owner_id_idx ON public.audit_logs USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'clinical_registry_record_sources_owner_id_idx',
          'CREATE INDEX clinical_registry_record_sources_owner_id_idx ON public.clinical_registry_record_sources USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'differential_records_owner_slug_kind_uidx',
          'CREATE UNIQUE INDEX differential_records_owner_slug_kind_uidx ON public.differential_records USING btree (owner_id, slug, kind)'
        ),
        -- 20260712170500
        (
          'document_chunks_document_id_idx',
          'CREATE INDEX document_chunks_document_id_idx ON public.document_chunks USING btree (document_id)'
        ),
        -- 20260712170500
        (
          'document_chunks_meta_rag_indexing_version_idx',
          'CREATE INDEX document_chunks_meta_rag_indexing_version_idx ON public.document_chunks USING btree (((metadata ->> ''rag_indexing_version''::text)))'
        ),
        -- 20260712170500
        (
          'document_embedding_fields_document_generation_idx',
          'CREATE INDEX document_embedding_fields_document_generation_idx ON public.document_embedding_fields USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260712170500
        (
          'document_embedding_fields_document_id_idx',
          'CREATE INDEX document_embedding_fields_document_id_idx ON public.document_embedding_fields USING btree (document_id)'
        ),
        -- 20260712170500
        (
          'document_images_created_at_idx',
          'CREATE INDEX document_images_created_at_idx ON public.document_images USING btree (created_at)'
        ),
        -- 20260712170500
        (
          'document_images_document_generation_idx',
          'CREATE INDEX document_images_document_generation_idx ON public.document_images USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260712170500
        (
          'document_images_document_id_idx',
          'CREATE INDEX document_images_document_id_idx ON public.document_images USING btree (document_id)'
        ),
        -- 20260712170500
        (
          'document_images_duplicate_group_idx',
          'CREATE INDEX document_images_duplicate_group_idx ON public.document_images USING btree (document_id, visual_duplicate_group)'
        ),
        -- 20260712170500
        (
          'document_images_priority_idx',
          'CREATE INDEX document_images_priority_idx ON public.document_images USING btree (document_id, clinical_priority_score DESC, page_number)'
        ),
        -- 20260712170500
        (
          'document_images_searchable_idx1',
          'CREATE INDEX document_images_searchable_idx1 ON public.document_images USING btree (searchable)'
        ),
        -- 20260712170500
        (
          'document_index_quality_document_id_idx',
          'CREATE INDEX document_index_quality_document_id_idx ON public.document_index_quality USING btree (document_id)'
        ),
        -- 20260712170500
        (
          'document_index_quality_owner_id_idx',
          'CREATE INDEX document_index_quality_owner_id_idx ON public.document_index_quality USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'document_index_units_document_generation_idx',
          'CREATE INDEX document_index_units_document_generation_idx ON public.document_index_units USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260712170500
        (
          'document_index_units_document_id_idx',
          'CREATE INDEX document_index_units_document_id_idx ON public.document_index_units USING btree (document_id)'
        ),
        -- 20260712170500
        (
          'document_index_units_owner_document_created_idx',
          'CREATE INDEX document_index_units_owner_document_created_idx ON public.document_index_units USING btree (owner_id, document_id, created_at DESC)'
        ),
        -- 20260712170500
        (
          'document_index_units_owner_id_idx',
          'CREATE INDEX document_index_units_owner_id_idx ON public.document_index_units USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'document_index_units_source_chunk_id_idx',
          'CREATE INDEX document_index_units_source_chunk_id_idx ON public.document_index_units USING btree (source_chunk_id)'
        ),
        -- 20260712170500
        (
          'document_index_units_source_image_id_idx',
          'CREATE INDEX document_index_units_source_image_id_idx ON public.document_index_units USING btree (source_image_id)'
        ),
        -- 20260712170500
        (
          'document_labels_owner_id_idx',
          'CREATE INDEX document_labels_owner_id_idx ON public.document_labels USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'document_memory_cards_document_generation_idx',
          'CREATE INDEX document_memory_cards_document_generation_idx ON public.document_memory_cards USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260712170500
        (
          'document_memory_cards_document_id_idx',
          'CREATE INDEX document_memory_cards_document_id_idx ON public.document_memory_cards USING btree (document_id)'
        ),
        -- 20260712170500
        (
          'document_memory_cards_owner_document_created_idx',
          'CREATE INDEX document_memory_cards_owner_document_created_idx ON public.document_memory_cards USING btree (owner_id, document_id, created_at DESC)'
        ),
        -- 20260712170500
        (
          'document_sections_document_generation_idx',
          'CREATE INDEX document_sections_document_generation_idx ON public.document_sections USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260712170500
        (
          'document_sections_document_id_idx',
          'CREATE INDEX document_sections_document_id_idx ON public.document_sections USING btree (document_id)'
        ),
        -- 20260712170500
        (
          'document_summaries_owner_id_idx',
          'CREATE INDEX document_summaries_owner_id_idx ON public.document_summaries USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'document_table_facts_document_generation_idx',
          'CREATE INDEX document_table_facts_document_generation_idx ON public.document_table_facts USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260712170500
        (
          'document_table_facts_title_row_param_trgm_idx',
          'CREATE INDEX document_table_facts_title_row_param_trgm_idx ON public.document_table_facts USING gin (lower(((((COALESCE(table_title, ''''::text) || '' ''::text) || COALESCE(row_label, ''''::text)) || '' ''::text) || COALESCE(clinical_parameter, ''''::text))) extensions.gin_trgm_ops)'
        ),
        -- 20260712170500
        (
          'documents_indexed_updated_at_idx',
          'CREATE INDEX documents_indexed_updated_at_idx ON public.documents USING btree (updated_at, id) WHERE (status = ''indexed''::text)'
        ),
        -- 20260712170500
        (
          'image_caption_cache_owner_id_idx',
          'CREATE INDEX image_caption_cache_owner_id_idx ON public.image_caption_cache USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'import_batches_owner_id_idx',
          'CREATE INDEX import_batches_owner_id_idx ON public.import_batches USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'ingestion_job_stages_job_idx',
          'CREATE INDEX ingestion_job_stages_job_idx ON public.ingestion_job_stages USING btree (job_id, started_at DESC)'
        ),
        -- 20260712170500
        (
          'ingestion_jobs_status_idx',
          'CREATE INDEX ingestion_jobs_status_idx ON public.ingestion_jobs USING btree (status)'
        ),
        -- 20260712170500
        (
          'ingestion_jobs_updated_at_idx',
          'CREATE INDEX ingestion_jobs_updated_at_idx ON public.ingestion_jobs USING btree (updated_at)'
        ),
        -- 20260712170500
        (
          'rag_queries_owner_id_idx',
          'CREATE INDEX rag_queries_owner_id_idx ON public.rag_queries USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'rag_query_misses_expected_chunk_id_idx',
          'CREATE INDEX rag_query_misses_expected_chunk_id_idx ON public.rag_query_misses USING btree (expected_chunk_id)'
        ),
        -- 20260712170500
        (
          'rag_query_misses_expected_document_id_idx',
          'CREATE INDEX rag_query_misses_expected_document_id_idx ON public.rag_query_misses USING btree (expected_document_id)'
        ),
        -- 20260712170500
        (
          'rag_query_misses_owner_id_idx',
          'CREATE INDEX rag_query_misses_owner_id_idx ON public.rag_query_misses USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'rag_response_cache_owner_id_idx',
          'CREATE INDEX rag_response_cache_owner_id_idx ON public.rag_response_cache USING btree (owner_id)'
        ),
        -- 20260712170500
        (
          'rag_retrieval_logs_owner_id_idx',
          'CREATE INDEX rag_retrieval_logs_owner_id_idx ON public.rag_retrieval_logs USING btree (owner_id)'
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
    actual_normalized := actual_def;
    actual_normalized := lower(actual_normalized);
    actual_normalized := replace(actual_normalized, 'create index if not exists', 'create index');
    actual_normalized := regexp_replace(actual_normalized, ' extensions\.', ' ', 'g');
    actual_normalized := regexp_replace(actual_normalized, ' using btree', '', 'g');
    actual_normalized := regexp_replace(actual_normalized, 'where \(([^()]*)\)$', 'where \1');
    actual_normalized := replace(actual_normalized, ';', '');
    actual_normalized := regexp_replace(actual_normalized, '[[:space:]]+', ' ', 'g');
    actual_normalized := regexp_replace(actual_normalized, ' on ([^ ()]+) \(', ' on \1(', 'g');
    actual_normalized := btrim(actual_normalized);

    expected_normalized := required.canonical_def;
    expected_normalized := lower(expected_normalized);
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
      'History guard 20260819110300: operational indexes recorded by 20260702150000 / 20260712165915 / 20260712170500 are not present in canonical form; create missing indexes concurrently outside the migration transaction, validate them, then apply this version. Missing: %; Invalid: %; Mismatched: %',
      coalesce(nullif(array_to_string(missing_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(invalid_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_indexes, ', '), ''), '(none)');
  end if;
end
$migration$;

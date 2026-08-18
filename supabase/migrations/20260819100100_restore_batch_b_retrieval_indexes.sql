-- Phase 4 Batch B (plan section 4.2): record the already-completed restoration of the six
-- repo-defined indexes on the large retrieval tables that live-drift reported as missing_live
-- (forensics section 1.3, 2026-08-14; still absent at the 2026-08-19 window pre-flight).
--
-- These sit on documents, document_images, document_chunks and document_index_units, which
-- carry real volume on production, so the concurrent-prebuild requirement is not optional
-- here: a transactional build would block writes on the retrieval path for its duration.
-- Like 20260804110240 this migration VALIDATES and never builds. Definitions are the
-- canonical ones already in supabase/schema.sql, so no mirror change accompanies it.
--
-- Timeouts use SET LOCAL so they do not leak into later migrations applied on the same CLI
-- session connection (plain SET is session-scoped).
--
-- Name resolution is canonical-only: none of these six has an entry in
-- search_schema_health()'s index_aliases map. Three of them (document_chunks_anchor_idx,
-- document_index_units_heading_path_idx, documents_registry_projection_lookup_idx) enter
-- required_indexes in 20260819100300, which is what makes their next disappearance visible
-- to the runtime probe rather than only to the weekly drift check.

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
          'documents_registry_projection_lookup_idx',
          'create index documents_registry_projection_lookup_idx on public.documents using btree (((metadata ->> ''registry_record_kind''::text)), ((metadata ->> ''registry_record_id''::text))) where ((metadata ->> ''source_kind''::text) = ''registry_record''::text)'
        ),
        (
          'document_images_hash_idx',
          'create index document_images_hash_idx on public.document_images using btree (document_id, image_hash) where (image_hash is not null)'
        ),
        (
          'document_images_structured_profile_gin_idx',
          'create index document_images_structured_profile_gin_idx on public.document_images using gin (((metadata -> ''structured_visual_profile''::text)))'
        ),
        (
          'document_images_visual_intelligence_version_idx',
          'create index document_images_visual_intelligence_version_idx on public.document_images using btree (((metadata ->> ''visual_intelligence_version''::text))) where (metadata ? ''visual_intelligence_version''::text)'
        ),
        (
          'document_chunks_anchor_idx',
          'create index document_chunks_anchor_idx on public.document_chunks using btree (document_id, anchor_id) where (anchor_id is not null)'
        ),
        (
          'document_index_units_heading_path_idx',
          'create index document_index_units_heading_path_idx on public.document_index_units using gin (heading_path)'
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
      'Phase 4 Batch B retrieval-table indexes were not prebuilt; create the missing indexes concurrently outside the migration transaction, validate them, then apply this version. Missing: %; Invalid: %; Mismatched: %',
      coalesce(nullif(array_to_string(missing_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(invalid_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_indexes, ', '), ''), '(none)');
  end if;
end
$migration$;

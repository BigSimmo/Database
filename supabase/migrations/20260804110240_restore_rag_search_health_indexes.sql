-- Record the already-completed RAG index repair without rebuilding indexes in a
-- transactional migration. Production creation and validation happened before
-- this version was marked applied; fresh replays receive the same definitions
-- from 20260705180000_reconcile_search_health_indexes.sql and schema.sql.
--
-- Plain CREATE INDEX here would hold write-blocking locks for the duration of
-- each build. A drifted hosted target must instead prebuild every missing index
-- with CREATE INDEX CONCURRENTLY outside a transaction, validate pg_index
-- indisvalid/indisready plus the canonical definition, and only then mark this
-- migration applied. This guard fails fast if that operator step was skipped.

set search_path = public, extensions, pg_catalog;
set lock_timeout = '5s';
set statement_timeout = '30s';

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
          'document_labels_label_trgm_idx',
          'create index document_labels_label_trgm_idx on public.document_labels using gin (lower(label) gin_trgm_ops)'
        ),
        (
          'document_summaries_summary_trgm_idx',
          'create index document_summaries_summary_trgm_idx on public.document_summaries using gin (lower(summary) gin_trgm_ops)'
        ),
        (
          'document_index_units_owner_chunk_type_idx',
          'create index document_index_units_owner_chunk_type_idx on public.document_index_units(owner_id, source_chunk_id, unit_type) where source_chunk_id is not null'
        ),
        (
          'rag_retrieval_logs_miss_idx',
          'create index rag_retrieval_logs_miss_idx on public.rag_retrieval_logs(is_miss, created_at desc) where is_miss = true'
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
      'RAG index repair was not prebuilt; create missing indexes concurrently outside the migration transaction, validate them, then mark this version applied. Missing: %; Invalid: %; Mismatched: %',
      coalesce(nullif(array_to_string(missing_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(invalid_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_indexes, ', '), ''), '(none)');
  end if;
end
$migration$;

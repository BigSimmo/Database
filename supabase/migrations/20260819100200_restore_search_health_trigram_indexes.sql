-- Plan section 4.4 debt: the fail-fast guard for the two retrieval-critical trigram indexes
-- restored in the 2026-08-14 incident window (forensics section Phase 4).
--
-- 20260804110240_restore_rag_search_health_indexes.sql names four OTHER indexes and never
-- checks this pair, so its application gave no existence bound for either of them
-- (forensics section 1.1). That is how both could vanish from production between 2026-07-05
-- and 2026-08-02 while every migration in the chain still replayed green. This guard closes
-- that hole: a later replay cannot silently proceed if either index disappears again. It
-- VALIDATES and never builds, per the 20260804110240 pattern.
--
-- Definitions are the canonical 20260705180000 / schema.sql forms - the coalesce(content, '')
-- rendering production has carried since the 2026-08-14 rebuild (forensics section 3.3(d)),
-- not the 2026-06-06 form staging still carries.
--
-- Timeouts use SET LOCAL so they do not leak into later migrations applied on the same CLI
-- session connection (plain SET is session-scoped).
--
-- ALIASES: unlike the four indexes in 20260804110240, both of these DO have
-- search_schema_health() index_aliases entries (documents_title_search_tsv_idx /
-- documents_title_search_idx, and document_chunks_search_tsv_idx /
-- document_chunks_search_idx). This guard deliberately resolves canonical names only: an
-- alias satisfying the health probe is not evidence that the canonical trigram index exists,
-- which is precisely the failure this guard exists to catch.

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
          'documents_title_trgm_idx',
          'create index documents_title_trgm_idx on public.documents using gin (lower(((coalesce(title, ''''::text) || '' ''::text) || coalesce(file_name, ''''::text))) extensions.gin_trgm_ops)'
        ),
        (
          'document_chunks_content_trgm_idx',
          'create index document_chunks_content_trgm_idx on public.document_chunks using gin (lower(((coalesce(section_heading, ''''::text) || '' ''::text) || coalesce(content, ''''::text))) extensions.gin_trgm_ops)'
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
      'The retrieval-critical trigram indexes restored on 2026-08-14 are not present in canonical form; rebuild them concurrently outside the migration transaction, validate them, then apply this version. Missing: %; Invalid: %; Mismatched: %',
      coalesce(nullif(array_to_string(missing_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(invalid_indexes, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_indexes, ', '), ''), '(none)');
  end if;
end
$migration$;

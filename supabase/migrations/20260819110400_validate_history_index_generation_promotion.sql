-- Phase 6.2 history guard (plan section 6.2; forensics section 1.1 / 3.7 / '6.2 completion'):
-- validate everything 20260702180000 promote_index_generation_id_columns left behind -- a hand-applied,
-- mark-applied version with three kinds of object. Ledger anchor #Q5JHBJ (#316 umbrella).
--
--   columns   index_generation_id uuid on document_images, document_table_facts,
--             document_embedding_fields, document_index_units, document_memory_cards, document_sections
--   indexes   the six <table>_document_generation_idx partial indexes (document_id, index_generation_id)
--             where index_generation_id is not null
--   functions is_committed_artifact_generation(uuid, jsonb) (new overload; the (jsonb, jsonb) one is
--             untouched), commit_document_index_generation(uuid, uuid, text, integer, integer, integer,
--             jsonb, jsonb, jsonb) -- the 9-argument overload; later migrations added the 11-argument one --
--             and cleanup_abandoned_document_index_generations(uuid, integer, boolean). The last two were
--             re-created by later executed migrations (20260713062125 / 20260708130000), so the pinned
--             def_hash is the CURRENT canonical body, exactly as supabase/drift-manifest.json records it.
--
-- Index definitions are the rendered pg_get_indexdef the manifest pins; function bodies are compared by
-- the manifest's def_hash, read from public.schema_drift_snapshot() so the hashing formula and
-- search_path are identical by construction to what the weekly live-drift check compares. ACLs are not
-- pinned here (check:drift compares them every run).
--
-- Like 20260804110240 this migration VALIDATES and never builds: catalog reads only, one raise naming
-- every failure. Timeouts use SET LOCAL so they do not leak into later migrations.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  missing_objects text[] := array[]::text[];
  invalid_objects text[] := array[]::text[];
  mismatched_objects text[] := array[]::text[];
  required record;
  table_oid regclass;
  column_type text;
  index_oid regclass;
  is_valid boolean;
  is_ready boolean;
  actual_def text;
  actual_normalized text;
  expected_normalized text;
  snapshot jsonb;
  live_hash text;
begin
  -- 1. typed columns
  for required in
    select *
    from (
      values
        ('document_images.index_generation_id'),
        ('document_table_facts.index_generation_id'),
        ('document_embedding_fields.index_generation_id'),
        ('document_index_units.index_generation_id'),
        ('document_memory_cards.index_generation_id'),
        ('document_sections.index_generation_id')
    ) as t(qualified_column)
  loop
    table_oid := to_regclass(format('public.%I', split_part(required.qualified_column, '.', 1)));
    if table_oid is null then
      missing_objects := array_append(missing_objects, required.qualified_column);
      continue;
    end if;
    select format_type(a.atttypid, a.atttypmod)
      into column_type
    from pg_attribute as a
    where a.attrelid = table_oid
      and a.attname = split_part(required.qualified_column, '.', 2)
      and not a.attisdropped;
    if column_type is null then
      missing_objects := array_append(missing_objects, required.qualified_column);
    elsif column_type <> 'uuid' then
      mismatched_objects := array_append(mismatched_objects, required.qualified_column || ' (' || column_type || ')');
    end if;
  end loop;

  -- 2. partial indexes
  for required in
    select *
    from (
      values
        -- 20260702180000
        (
          'document_images_document_generation_idx',
          'CREATE INDEX document_images_document_generation_idx ON public.document_images USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260702180000
        (
          'document_table_facts_document_generation_idx',
          'CREATE INDEX document_table_facts_document_generation_idx ON public.document_table_facts USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260702180000
        (
          'document_embedding_fields_document_generation_idx',
          'CREATE INDEX document_embedding_fields_document_generation_idx ON public.document_embedding_fields USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260702180000
        (
          'document_index_units_document_generation_idx',
          'CREATE INDEX document_index_units_document_generation_idx ON public.document_index_units USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260702180000
        (
          'document_memory_cards_document_generation_idx',
          'CREATE INDEX document_memory_cards_document_generation_idx ON public.document_memory_cards USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        ),
        -- 20260702180000
        (
          'document_sections_document_generation_idx',
          'CREATE INDEX document_sections_document_generation_idx ON public.document_sections USING btree (document_id, index_generation_id) WHERE (index_generation_id IS NOT NULL)'
        )
    ) as t(index_name, canonical_def)
  loop
    index_oid := to_regclass(format('public.%I', required.index_name));
    if index_oid is null then
      missing_objects := array_append(missing_objects, required.index_name);
      continue;
    end if;

    select i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid)
      into is_valid, is_ready, actual_def
    from pg_index as i
    where i.indexrelid = index_oid;

    if not coalesce(is_valid, false) or not coalesce(is_ready, false) then
      invalid_objects := array_append(invalid_objects, required.index_name);
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
      mismatched_objects := array_append(mismatched_objects, required.index_name);
    end if;
  end loop;

  -- 3. function bodies, hashed exactly as the drift probe hashes them
  snapshot := public.schema_drift_snapshot();
  for required in
    select *
    from (
      values
        ('public.is_committed_artifact_generation(uuid,jsonb)', '755e8ba3a7f52efcef604074d0832dde'),
        ('public.commit_document_index_generation(uuid,uuid,text,integer,integer,integer,jsonb,jsonb,jsonb)', '594b1f715fbbfa1df1b1f1183a7fef5a'),
        ('public.cleanup_abandoned_document_index_generations(uuid,integer,boolean)', '4ee148dcab28d6bbe10cfa542213f0f6')
    ) as t(signature, expected_hash)
  loop
    select f.element ->> 'def_hash'
      into live_hash
    from jsonb_array_elements(coalesce(snapshot -> 'functions', '[]'::jsonb)) as f(element)
    where f.element ->> 'signature' = required.signature;

    if live_hash is null then
      missing_objects := array_append(missing_objects, required.signature);
    elsif live_hash <> required.expected_hash then
      mismatched_objects := array_append(mismatched_objects, required.signature || ' def_hash ' || live_hash);
    end if;
  end loop;

  if cardinality(missing_objects) > 0
     or cardinality(invalid_objects) > 0
     or cardinality(mismatched_objects) > 0 then
    raise exception
      'History guard 20260819110400: the columns / partial indexes / functions recorded by 20260702180000 are not in canonical form; reconcile out of band (CREATE INDEX CONCURRENTLY for a missing index on a populated table), then apply this version. Missing: %; Invalid: %; Mismatched: %',
      coalesce(nullif(array_to_string(missing_objects, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(invalid_objects, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_objects, ', '), ''), '(none)');
  end if;
end
$migration$;

-- Fail-fast validation guard for the #ZBAC9D ownerless-publication invariant.
--
-- Follows the 20260804110240_restore_rag_search_health_indexes.sql pattern: it VALIDATES
-- and never builds. If the three preceding migrations in this change were replayed but
-- their statements did not take effect on the target -- the shape the guard-migration
-- contract in AGENTS.md exists for -- this raises rather than letting the version be
-- recorded as applied over a database that does not carry the invariant.
--
-- The contract does not strictly require a guard here: these are ordinary forward
-- migrations whose statements execute, not a history repair or a mark-applied version, so
-- supabase/drift-allowlist.json needs no entry. It ships because a silently-absent
-- invariant is exactly the failure this issue is about, and because the constraint's
-- NOT VALID / VALIDATE split means "present" and "enforced for existing rows" are two
-- different states that a presence check alone would conflate.
--
-- The index guard's indisvalid/indisready step has no function analogue. Its counterpart
-- for the "invalid" bucket here is a behavioural probe -- the same technique
-- 20260708160001 and 20260713020000 already use for retrieval_owner_matches -- which is
-- what distinguishes an object that exists from one that behaves.
--
-- Definition normalization strips whitespace, ::text casts and parentheses before
-- comparing, so the pin survives Postgres's own rendering of the expression (which adds
-- casts and parens the source text does not have) while still being an exact match on the
-- operands and their order, not a containment test. The ::jsonb cast is deliberately NOT
-- stripped: it is what makes the predicate test the JSON boolean rather than its text
-- rendering, so it is part of what this guard pins.
-- tests/supabase-schema.test.ts reimplements this normalizer and asserts it against a
-- hard-coded pg_get_constraintdef render, so the highest-risk logic here is covered
-- offline rather than only on the target.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  missing_objects text[] := array[]::text[];
  invalid_objects text[] := array[]::text[];
  mismatched_objects text[] := array[]::text[];
  constraint_row record;
  function_oid regprocedure;
  function_def text;
  actual_normalized text;
  expected_normalized text;
  probe_count integer;
  sentinel constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  owned constant uuid := '11111111-1111-1111-1111-111111111111'::uuid;
begin
  -- 1. The write-side invariant: present, enforced, and the definition we shipped.
  select c.conname, c.convalidated, pg_catalog.pg_get_constraintdef(c.oid) as definition
  into constraint_row
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.documents'::regclass
    and c.conname = 'documents_ownerless_requires_publication_marker';

  if not found then
    missing_objects := array_append(missing_objects, 'documents_ownerless_requires_publication_marker');
  else
    if not constraint_row.convalidated then
      -- Present but NOT VALID: new writes are checked, existing rows were never scanned,
      -- so the invariant does not actually hold over the corpus.
      invalid_objects := array_append(
        invalid_objects,
        'documents_ownerless_requires_publication_marker (constraint is NOT VALID; 20260902111000 did not take effect)'
      );
    end if;

    actual_normalized := btrim(regexp_replace(replace(replace(replace(replace(lower(coalesce(constraint_row.definition, '')), '::text', ''), '(', ''), ')', ''), ' ', ''), '[[:space:]]+', '', 'g'));
    expected_normalized := btrim(regexp_replace(replace(replace(replace(replace(lower(coalesce('CHECK (owner_id IS NOT NULL OR metadata->''public_corpus'' = ''true''::jsonb OR status = ''failed'')', '')), '::text', ''), '(', ''), ')', ''), ' ', ''), '[[:space:]]+', '', 'g'));
    if actual_normalized is distinct from expected_normalized then
      mismatched_objects := array_append(
        mismatched_objects,
        format('documents_ownerless_requires_publication_marker (found: %s)', constraint_row.definition)
      );
    end if;
  end if;

  -- 2. The read-side hole closure.
  function_oid := pg_catalog.to_regprocedure('public.get_related_document_metadata(uuid[],uuid)');
  if function_oid is null then
    missing_objects := array_append(missing_objects, 'get_related_document_metadata(uuid[],uuid)');
  else
    function_def := btrim(regexp_replace(replace(replace(replace(replace(lower(coalesce(pg_catalog.pg_get_functiondef(function_oid), '')), '::text', ''), '(', ''), ')', ''), ' ', ''), '[[:space:]]+', '', 'g'));

    -- The two conjuncts this issue turns on: the status filter added by 20260902110000,
    -- and the owner predicate it must keep sitting beside.
    if position('d.status=''indexed''' in function_def) = 0 then
      mismatched_objects := array_append(
        mismatched_objects,
        'get_related_document_metadata (status = ''indexed'' filter absent; 20260902110000 did not take effect)'
      );
    end if;
    if position('public.retrieval_owner_matchesowner_filter,d.owner_id' in function_def) = 0 then
      mismatched_objects := array_append(
        mismatched_objects,
        'get_related_document_metadata (retrieval_owner_matches owner predicate absent)'
      );
    end if;

    -- Behavioural probe: exists AND runs. An empty id array reads no rows and writes
    -- nothing, so this is safe to execute inside the migration transaction.
    begin
      select count(*)::integer
      into probe_count
      from public.get_related_document_metadata(array[]::uuid[], null::uuid);
      if probe_count <> 0 then
        invalid_objects := array_append(
          invalid_objects,
          format('get_related_document_metadata (empty id array returned %s rows)', probe_count)
        );
      end if;
    exception
      when others then
        invalid_objects := array_append(
          invalid_objects,
          format('get_related_document_metadata (probe raised %s)', sqlerrm)
        );
    end;
  end if;

  -- 3. The owner predicate the whole contract rests on, probed as a truth table exactly
  --    as 20260708160001 does. If this drifted, the invariant above guards nothing.
  if pg_catalog.to_regprocedure('public.retrieval_owner_matches(uuid,uuid)') is null then
    missing_objects := array_append(missing_objects, 'retrieval_owner_matches(uuid,uuid)');
  else
    if public.retrieval_owner_matches(null::uuid, null::uuid) is distinct from false then
      invalid_objects := array_append(
        invalid_objects,
        'retrieval_owner_matches(NULL, NULL) must be FALSE (fail closed; no global escape hatch)'
      );
    end if;
    if public.retrieval_owner_matches(sentinel, null::uuid) is distinct from true then
      invalid_objects := array_append(
        invalid_objects,
        'retrieval_owner_matches(sentinel, NULL) must be TRUE (public corpus row)'
      );
    end if;
    if public.retrieval_owner_matches(sentinel, owned) is distinct from false then
      invalid_objects := array_append(
        invalid_objects,
        'retrieval_owner_matches(sentinel, owned) must be FALSE (no cross-tenant read)'
      );
    end if;
    if public.retrieval_owner_matches(owned, owned) is distinct from true then
      invalid_objects := array_append(
        invalid_objects,
        'retrieval_owner_matches(owner, same owner) must be TRUE'
      );
    end if;
  end if;

  if cardinality(missing_objects) > 0
     or cardinality(invalid_objects) > 0
     or cardinality(mismatched_objects) > 0 then
    raise exception
      'The #ZBAC9D ownerless-publication invariant is not in force on this database; apply 20260902110000, 20260902110500 and 20260902111000 for real before marking this version applied. Missing: %; Invalid: %; Mismatched: %',
      coalesce(nullif(array_to_string(missing_objects, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(invalid_objects, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_objects, ', '), ''), '(none)');
  end if;
end
$migration$;

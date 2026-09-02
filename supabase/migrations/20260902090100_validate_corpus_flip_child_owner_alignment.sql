-- Fail-fast validation guard for
-- 20260902090000_align_corpus_flip_retrieval_scoped_child_owners.sql.
--
-- Modelled on 20260804110240_restore_rag_search_health_indexes.sql: it
-- validates and never builds. It defines no object, replaces no function and
-- creates no index; if the version it guards was recorded without executing its
-- statements (the #Q5JHBJ failure shape, which neither the object inventory nor
-- the history probe catches on its own for a function body that still exists in
-- an older form), this version raises instead of passing quietly.
--
-- Timeouts use SET LOCAL so they do not leak into later migrations applied on
-- the same CLI session connection (plain SET is session-scoped).
--
-- The fragments below are the load-bearing half of the corpus switch: the three
-- derived tables whose own owner_id reaches public.retrieval_owner_matches must
-- be published with their documents and restored with them, and the switch must
-- stay service-role-only with its search_path and timeouts pinned.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  target regprocedure;
  normalized text;
  acl_text text;
  config_text text;
  required record;
  absent_objects text[] := array[]::text[];
  missing_fragments text[] := array[]::text[];
  wrong_settings text[] := array[]::text[];
begin
  target := to_regprocedure('public.set_document_corpus_access_mode(text)');

  if target is null then
    absent_objects := array_append(absent_objects, 'public.set_document_corpus_access_mode(text)');
  else
    normalized := btrim(regexp_replace(lower(pg_get_functiondef(target)), '[[:space:]]+', ' ', 'g'));

    for required in
      select *
      from (
        values
          ('update public.document_labels l set owner_id = null'),
          ('update public.document_summaries s set owner_id = null'),
          ('update public.document_table_facts f set owner_id = null'),
          ('update public.document_labels l set owner_id = existing_owner.id'),
          ('update public.document_summaries s set owner_id = existing_owner.id'),
          ('update public.document_table_facts f set owner_id = existing_owner.id'),
          ('join auth.users existing_owner on existing_owner.id = snapshot.owner_id')
      ) as t(fragment)
    loop
      if position(required.fragment in normalized) = 0 then
        missing_fragments := array_append(missing_fragments, required.fragment);
      end if;
    end loop;

    select
      coalesce(array_to_string(p.proacl, ' '), ''),
      coalesce(array_to_string(p.proconfig, ' '), '')
      into acl_text, config_text
    from pg_proc as p
    where p.oid = target;

    if position('search_path=' in replace(config_text, ' ', '')) = 0 then
      wrong_settings := array_append(wrong_settings, 'search_path is not pinned');
    end if;
    if position('statement_timeout=' in replace(config_text, ' ', '')) = 0 then
      wrong_settings := array_append(wrong_settings, 'statement_timeout is not pinned');
    end if;
    if position('lock_timeout=' in replace(config_text, ' ', '')) = 0 then
      wrong_settings := array_append(wrong_settings, 'lock_timeout is not pinned');
    end if;
    if acl_text ~ '(^|[ ,])(anon|authenticated)=' or acl_text ~ '(^|[ ,])=X' then
      wrong_settings := array_append(wrong_settings, 'execute is granted beyond service_role');
    end if;
    if position('service_role=x' in lower(acl_text)) = 0 then
      wrong_settings := array_append(wrong_settings, 'service_role cannot execute the switch');
    end if;
  end if;

  if cardinality(absent_objects) > 0
     or cardinality(missing_fragments) > 0
     or cardinality(wrong_settings) > 0 then
    raise exception
      'corpus access switch was recorded without its retrieval-scoped derived owner alignment; apply 20260902090000 before marking this version applied. Missing: %; Unaligned: %; Settings: %',
      coalesce(nullif(array_to_string(absent_objects, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(missing_fragments, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(wrong_settings, ', '), ''), '(none)');
  end if;
end
$migration$;

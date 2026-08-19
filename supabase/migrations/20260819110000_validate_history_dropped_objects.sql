-- Phase 6.2 history guard (plan section 6.2; forensics section 1.1 / 3.7 / '6.2 completion'):
-- validate that three hand-applied, mark-applied versions whose only persistent effect is a DROP
-- really left the objects absent. Ledger anchor #Q5JHBJ (#316 umbrella).
--
--   20260701040000 drop_dead_drifted_hybrid_variants  -> seven dead live-only hybrid variant functions,
--       dropped by their exact 2026-07-01 signatures. The 7-argument (..., boolean) overloads of
--       match_document_embedding_fields_hybrid_v2 / match_document_memory_cards_hybrid_v3 that schema.sql
--       declares are DIFFERENT objects and are deliberately not touched here.
--   20260702110000 drop_redundant_indexes             -> documents_owner_hash_idx, ingestion_jobs_claim_idx
--   20260712172000 drop_redundant_table_fact_indexes  -> document_table_facts_document_id_idx,
--       document_table_facts_owner_idx (both re-created by the no-statements 20260712170500 and dropped
--       again here; production's orphan document_table_facts_document_id_idx was dropped concurrently in
--       the Phase 4 window, so absence is the recorded end state on both tiers).
--
-- Like 20260804110240 this migration VALIDATES and never builds or drops: it only reads the catalog
-- and raises once, naming every object that is unexpectedly present. Timeouts use SET LOCAL so they
-- do not leak into later migrations applied on the same CLI session connection. Safe to re-run.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  present_functions text[] := array[]::text[];
  present_indexes text[] := array[]::text[];
  required record;
begin
  for required in
    select *
    from (
      values
        -- 20260701040000
        ('eval_memory_retrieval_v2_v3', 'public.eval_memory_retrieval_v2_v3(extensions.vector,text,integer,double precision,uuid[],uuid)'),
        -- 20260701040000
        ('match_document_memory_cards_hybrid_v3', 'public.match_document_memory_cards_hybrid_v3(extensions.vector,text,integer,double precision,uuid[],uuid)'),
        -- 20260701040000
        ('match_document_embedding_fields_rrf', 'public.match_document_embedding_fields_rrf(extensions.vector,text,integer,integer,double precision,double precision,integer,double precision,double precision,uuid[],uuid)'),
        -- 20260701040000
        ('match_document_embedding_fields_vector', 'public.match_document_embedding_fields_vector(extensions.vector,integer,double precision,uuid[],uuid)'),
        -- 20260701040000
        ('match_document_chunks_hybrid_review_v1', 'public.match_document_chunks_hybrid_review_v1(extensions.vector,text,integer,double precision,uuid[],uuid,boolean)'),
        -- 20260701040000
        ('match_document_embedding_fields_hybrid_v2', 'public.match_document_embedding_fields_hybrid_v2(extensions.vector,text,integer,double precision,uuid[],uuid)'),
        -- 20260701040000
        ('match_document_index_units_hybrid_v3', 'public.match_document_index_units_hybrid_v3(extensions.vector,text,integer,double precision,uuid[],uuid)')
    ) as t(object_name, signature)
  loop
    if to_regprocedure(required.signature) is not null then
      present_functions := array_append(present_functions, required.signature);
    end if;
  end loop;

  for required in
    select *
    from (
      values
        -- 20260702110000
        ('documents_owner_hash_idx'),
        -- 20260702110000
        ('ingestion_jobs_claim_idx'),
        -- 20260712172000
        ('document_table_facts_document_id_idx'),
        -- 20260712172000
        ('document_table_facts_owner_idx')
    ) as t(index_name)
  loop
    if to_regclass(format('public.%I', required.index_name)) is not null then
      present_indexes := array_append(present_indexes, required.index_name);
    end if;
  end loop;

  if cardinality(present_functions) > 0 or cardinality(present_indexes) > 0 then
    raise exception
      'History guard 20260819110000: objects that 20260701040000 / 20260702110000 / 20260712172000 dropped are still present; the recorded history claims a state this database does not have. Drop them out of band (DROP INDEX CONCURRENTLY for an index on a populated table), then apply this version. Missing: (none); Invalid: (none); Mismatched (unexpectedly present) functions: %; indexes: %',
      coalesce(nullif(array_to_string(present_functions, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(present_indexes, ', '), ''), '(none)');
  end if;
end
$migration$;

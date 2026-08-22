-- Phase 6.2 history guard (plan section 6.2; forensics section 1.1 / 3.7 / '6.2 completion'):
-- validate the fifteen function bodies that four hand-applied, mark-applied versions defined.
-- Ledger anchor #Q5JHBJ (#316 umbrella).
--
--   20260702140000 fix_reset_document_index_duplicate  -> reset_document_index(uuid)
--   20260702160000 fix_invoke_agent_url_to_guc          -> invoke_indexing_v3_agent(integer); its
--       ALTER DATABASE SET app.indexing_v3_agent_base_url is privilege-guarded and the function carries
--       a fallback, so the GUC is deliberately not validated
--   20260712171500 codify_live_ahead_functions          -> get_related_document_metadata,
--       get_visual_evidence_cards, match_document_chunks, match_document_chunks_hybrid,
--       match_document_chunks_text, match_document_embedding_fields_text, match_document_table_facts_text,
--       match_documents_for_query, repair_enrichment_quality_batch, repair_strict_enrichment_gate_batch,
--       run_all_visual_eval_cases, run_visual_eval_case (12)
--   20260712173000 add_legacy_index_health_batch_repair -> backfill_legacy_index_health_batch(integer)
--
-- Four of the twelve 20260712171500 bodies were re-created by later executed migrations
-- (match_document_chunks / match_document_chunks_hybrid / match_document_chunks_text by 20260714110000,
-- match_document_table_facts_text by 20260724120000) and 20260818110000 then set work_mem on three, so each
-- pinned def_hash is the CURRENT canonical body: the value supabase/drift-manifest.json records, which
-- live-drift proved equal to production for every public function (zero function mismatches, run
-- 32171070287 after PR #2151 merged) and the staging comparison proved equal to the chain.
--
-- Bodies are compared by def_hash read from public.schema_drift_snapshot(), so the hashing formula
-- (pg_get_functiondef with comments and whitespace stripped) and the search_path-'' rendering are
-- identical by construction to what the weekly check compares. ACLs are not pinned here because
-- acldefault() renders the function owner, which differs on a preview branch; check:drift compares
-- ACLs on every run.
--
-- Like 20260804110240 this migration VALIDATES and never creates or replaces a function: one
-- snapshot read, one raise naming every failure. Timeouts use SET LOCAL.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  missing_functions text[] := array[]::text[];
  mismatched_functions text[] := array[]::text[];
  required record;
  snapshot jsonb;
  live_hash text;
begin
  snapshot := public.schema_drift_snapshot();

  for required in
    select *
    from (
      values
        -- 20260702140000
        ('public.reset_document_index(uuid)', '243f3960a32db0192d1cce2ebd050004'),
        -- 20260702160000
        ('public.invoke_indexing_v3_agent(integer)', '3ffdb174b4cef3905a3ed45e9b0dab6b'),
        -- 20260712171500
        ('public.get_related_document_metadata(uuid[],uuid)', 'ebb4dbc57321d9c0c4c011c52fc0dde1'),
        -- 20260712171500
        ('public.get_visual_evidence_cards(uuid,integer)', '107d6e5eb6d846971b48102c258ab2eb'),
        -- 20260712171500
        ('public.match_document_chunks(extensions.vector,integer,double precision,uuid,uuid)', 'cdf9d685c98bc8ff731a0422c29a47a4'),
        -- 20260712171500
        ('public.match_document_chunks_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)', '5902c39286335c07714e498ea31513a0'),
        -- 20260712171500
        ('public.match_document_chunks_text(text,integer,uuid[],uuid)', 'd135c628720cb8a4d86c2ade4cd3b26a'),
        -- 20260712171500
        ('public.match_document_embedding_fields_text(text,integer,double precision,uuid[],uuid)', '6fa9e80ed59c16922806590e67083188'),
        -- 20260712171500
        ('public.match_document_table_facts_text(text,integer,uuid[],uuid)', '0ef9a5dfbde03fe6d48d9223e245aa69'),
        -- 20260712171500
        ('public.match_documents_for_query(text,integer,uuid)', '8248e8d1aec23bbad35aca0ddc4dc94d'),
        -- 20260712171500
        ('public.repair_enrichment_quality_batch(integer)', '2258b6a4a9fd85bdf10a768778fb5d55'),
        -- 20260712171500
        ('public.repair_strict_enrichment_gate_batch(integer)', '62892dfd90b840b55e07e3bdfc988339'),
        -- 20260712171500
        ('public.run_all_visual_eval_cases(integer)', '22124c67028e9957d39788548f0f358a'),
        -- 20260712171500
        ('public.run_visual_eval_case(uuid,integer)', 'c0b5662d2c6f63ff05a7ed05573845fe'),
        -- 20260712173000
        ('public.backfill_legacy_index_health_batch(integer)', '2edbe5e02d8585898df0f3fd8f2ade8a')
    ) as t(signature, expected_hash)
  loop
    select f.element ->> 'def_hash'
      into live_hash
    from jsonb_array_elements(coalesce(snapshot -> 'functions', '[]'::jsonb)) as f(element)
    where f.element ->> 'signature' = required.signature;

    if live_hash is null then
      missing_functions := array_append(missing_functions, required.signature);
    elsif live_hash <> required.expected_hash then
      mismatched_functions := array_append(mismatched_functions, required.signature || ' def_hash ' || live_hash);
    end if;
  end loop;

  if cardinality(missing_functions) > 0 or cardinality(mismatched_functions) > 0 then
    raise exception
      'History guard 20260819110500: function bodies recorded by 20260702140000 / 20260702160000 / 20260712171500 / 20260712173000 do not match the canonical def_hash (supabase/drift-manifest.json). Re-apply the canonical body from supabase/schema.sql out of band, then apply this version. Missing: %; Invalid: (none); Mismatched: %',
      coalesce(nullif(array_to_string(missing_functions, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_functions, ', '), ''), '(none)');
  end if;
end
$migration$;

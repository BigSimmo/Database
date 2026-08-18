-- Phase 4.4 monitoring ratchet: put the eight Phase 6.3 monitor-candidates into
-- search_schema_health()'s required_indexes list.
--
-- Plan of record: docs/database-remediation-plan.md sections 4.4 and 6.3; evidence:
-- docs/audit/live-drift-forensics-2026-08.md sections 1.3, Phase 4 and Phase 6.
-- Ledger anchor #316.
--
-- WHY: search_schema_health() monitors a curated list, and every one of the twenty
-- indexes that went missing on production was invisible to it. The runtime probe
-- reported ok: true for weeks while the retrieval path did sequential scans. The
-- 6.3 ratchet (tests/search-health-index-coverage.test.ts +
-- supabase/search-health-unmonitored-indexes.json) made every monitoring decision on
-- the six retrieval-critical tables explicit and left exactly eight indexes flagged
-- 'monitor-candidate' — deliberately deferred to this migration, because
-- required_indexes changes travel by migration only, never by editing the mirror.
--
-- All eight are now monitored:
--   * documents_registry_projection_lookup_idx, document_chunks_anchor_idx and
--     document_index_units_heading_path_idx were three of the twenty absent indexes.
--     They were rebuilt concurrently and validated in the 2026-08-19 window
--     (guards 20260819100000 / 20260819100100) BEFORE this migration adds them, so
--     it cannot turn the probe red on a still-absent object.
--   * documents_search_idx, document_embedding_fields_search_tsv_chunk_gin_idx,
--     document_index_units_search_idx, document_index_units_terms_idx and
--     document_memory_cards_search_idx are GIN indexes on the lexical half of the
--     retrieval RPCs, all present and valid on production, none of which had any
--     monitored equivalent. document_index_units was the worst-covered table in the
--     scope at 2 of 16 monitored.
--
-- After this, supabase/search-health-unmonitored-indexes.json carries no
-- 'monitor-candidate' entries: every remaining entry is a reasoned
-- 'accepted-unmonitored'. The coverage test rejects an entry that is also monitored,
-- so the eight are removed from that file in the same change.
--
-- SCOPE: this changes which index absences the probe REPORTS. It adds no index,
-- drops none, and touches no retrieval SQL, ranking input or RPC body. The probe
-- feeds /api/setup-status only (src/app/api/setup-status/route.ts) and is not on the
-- answer path, so an expanded list cannot alter retrieval behaviour.
--
-- The body below is 20260706010000_search_schema_health_m13_guard.sql's definition
-- verbatim, with the eight names appended to required_indexes and nothing else
-- changed; index_aliases, the M13 commit_document_index_generation probe, the
-- hybrid-RPC smoke checks and the grants are all carried over unmodified.

set search_path = public, extensions, pg_catalog;

create or replace function public.search_schema_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  missing text[] := array[]::text[];
  vector_type_oid oid;
  vector_schema text;
  index_name text;
  legacy_ivfflat_indexes text[];
  zero_vec extensions.vector(1536);
  probe_text text := 'schema health probe zzznomatch';
  hybrid_rpcs text[] := array[
    'match_document_chunks_hybrid',
    'match_document_index_units_hybrid',
    'match_document_embedding_fields_hybrid',
    'match_document_memory_cards_hybrid'
  ];
  rpc_name text;
  commit_fn_def text;
  required_indexes constant text[] := array[
    'documents_title_trgm_idx',
    'document_chunks_content_trgm_idx',
    'document_labels_label_trgm_idx',
    'document_summaries_summary_trgm_idx',
    'document_chunks_embedding_hnsw_idx',
    'document_embedding_fields_embedding_hnsw_idx',
    'document_memory_cards_embedding_hnsw_idx',
    'documents_indexed_owner_title_idx',
    'document_table_facts_owner_document_page_idx',
    'document_embedding_fields_owner_chunk_idx',
    'document_index_units_owner_chunk_type_idx',
    'document_table_facts_source_image_idx',
    'document_pages_document_idx',
    'document_sections_document_idx',
    'document_chunks_document_idx',
    'document_memory_cards_document_idx',
    'document_embedding_fields_document_idx',
    'document_table_facts_document_idx',
    'document_index_units_document_idx',
    'rag_retrieval_logs_owner_created_idx',
    'rag_retrieval_logs_miss_idx',
    'rag_retrieval_logs_strategy_idx',
    'documents_search_idx',
    'documents_registry_projection_lookup_idx',
    'document_chunks_anchor_idx',
    'document_embedding_fields_search_tsv_chunk_gin_idx',
    'document_index_units_heading_path_idx',
    'document_index_units_search_idx',
    'document_index_units_terms_idx',
    'document_memory_cards_search_idx'
  ];
  index_aliases constant jsonb := jsonb_build_object(
    'documents_title_trgm_idx', jsonb_build_array('documents_title_search_tsv_idx', 'documents_title_search_idx'),
    'document_chunks_content_trgm_idx', jsonb_build_array('document_chunks_search_tsv_idx', 'document_chunks_search_idx'),
    'document_table_facts_owner_document_page_idx', jsonb_build_array('document_table_facts_owner_idx'),
    'document_pages_document_idx', jsonb_build_array('document_pages_document_id_page_number_key'),
    'document_sections_document_idx', jsonb_build_array('document_sections_document_id_idx'),
    'rag_retrieval_logs_owner_created_idx', jsonb_build_array('rag_retrieval_logs_owner_id_idx')
  );
begin
  select t.oid, n.nspname
  into vector_type_oid, vector_schema
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where t.typname = 'vector'
    and n.nspname = 'extensions'
  limit 1;

  if vector_type_oid is null then
    missing := array_append(missing, 'extensions.vector_type');
  end if;

  if to_regprocedure('public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid)') is null then
    missing := array_append(missing, 'match_document_chunks.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_chunks_hybrid.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_chunks_text(text, integer, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_chunks_text.signature');
  end if;
  if to_regprocedure('public.match_document_lookup_chunks_text(text, uuid[], integer, uuid)') is null then
    missing := array_append(missing, 'match_document_lookup_chunks_text.signature');
  end if;
  if to_regprocedure('public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_memory_cards_hybrid.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_memory_cards_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_memory_cards_hybrid_v2.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_index_units_hybrid.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_embedding_fields_hybrid.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_documents_for_query(text, integer, uuid)') is null then
    missing := array_append(missing, 'match_documents_for_query.signature');
  end if;
  if to_regprocedure('public.match_document_table_facts_text(text, integer, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_table_facts_text.signature');
  end if;
  if to_regprocedure('public.explain_retrieval_rpc(text, text, integer, uuid, uuid[], boolean)') is null then
    missing := array_append(missing, 'explain_retrieval_rpc.signature');
  end if;
  if to_regclass('public.rag_retrieval_logs') is null then
    missing := array_append(missing, 'rag_retrieval_logs.table');
  end if;

  foreach index_name in array required_indexes loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public'
        and c.relname = index_name
        and c.relkind = 'i'
    )
    and not (
      index_aliases ? index_name
      and exists (
        select 1
        from pg_class c
        join pg_namespace ns on ns.oid = c.relnamespace
        where ns.nspname = 'public'
          and c.relkind = 'i'
          and c.relname in (
            select jsonb_array_elements_text(index_aliases -> index_name)
          )
      )
    ) then
      missing := array_append(missing, index_name);
    end if;
  end loop;

  if vector_type_oid is not null then
    zero_vec := (select ('[' || string_agg('0', ',') || ']') from generate_series(1, 1536))::extensions.vector(1536);
    foreach rpc_name in array hybrid_rpcs loop
      begin
        execute format(
          'select 1 from public.%I($1, $2, 1, 0.1, null::uuid[], null::uuid) limit 1',
          rpc_name
        ) using zero_vec, probe_text;
      exception
        when undefined_function then
          missing := array_append(missing, rpc_name || '.execution_signature');
        when others then
          missing := array_append(missing, rpc_name || '.execution:' || SQLSTATE);
      end;
    end loop;
  end if;

  commit_fn_def := pg_get_functiondef(
    to_regprocedure(
      'public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb)'
    )
  );
  if commit_fn_def is null then
    missing := array_append(missing, 'commit_document_index_generation.signature');
  elsif position('from public.document_chunks replacement' in commit_fn_def) = 0 then
    missing := array_append(
      missing,
      'commit_document_index_generation.preserve_legacy_artifacts_migration'
    );
  end if;

  select public.detect_legacy_ivfflat_indexes() into legacy_ivfflat_indexes;

  return jsonb_build_object(
    'ok', cardinality(missing) = 0,
    'missing', missing,
    'vector_extension_schema', vector_schema,
    'legacy_ivfflat_indexes', coalesce(legacy_ivfflat_indexes, array[]::text[]),
    'deferred_hnsw_indexes', array[]::text[],
    'checked_at', now()
  );
end;
$$;

revoke execute on function public.search_schema_health() from public, anon, authenticated;
grant execute on function public.search_schema_health() to service_role;

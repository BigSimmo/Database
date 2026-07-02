-- Reconcile search_schema_health() into a single superset definition.
--
-- The function had diverged on two lineages: the live copy carried an
-- execution smoke (zero-vector invoke of each hybrid RPC, added after the
-- 42702 ambiguous-id regression proved signature checks are not enough) but
-- had dropped the comprehensive required_indexes / signature checks; the
-- schema.sql + migration copy kept the comprehensive checks but lacked the
-- smoke. This migration merges both: all signature checks (now including
-- match_document_memory_cards_hybrid_v2), the full required-index list
-- (updated for the 20260702014803 index drops: no index_units HNSW entry,
-- memory_cards HNSW added - all 22 entries verified present live before
-- shipping), the legacy-ivfflat report, AND the execution smoke. Matches
-- supabase/schema.sql exactly (extracted from it, not re-typed).
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
    'rag_retrieval_logs_strategy_idx'
  ];
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
    ) then
      missing := array_append(missing, index_name);
    end if;
  end loop;

  -- Execution smoke: invoke each hybrid RPC with a zero vector so silent runtime
  -- breaks (e.g. the historical 42702 ambiguous-id plpgsql regression) surface as
  -- `<rpc>.execution:<sqlstate>` instead of passing a signature-only check. Only
  -- runs when the vector type resolved, so a missing extension is not double
  -- reported; each RPC gets its own sub-block so one failure does not mask others.
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

create or replace function public.search_schema_health()
returns jsonb
language plpgsql
stable
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  missing text[] := array[]::text[];
  vector_type_oid oid;
  vector_schema text;
  index_name text;
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

  if vector_type_oid is not null and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_document_chunks'
      and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_chunks.extensions_vector_signature');
  end if;

  if vector_type_oid is not null and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_document_chunks_hybrid'
      and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_chunks_hybrid.extensions_vector_signature');
  end if;

  if vector_type_oid is not null and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_document_memory_cards_hybrid'
      and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_memory_cards_hybrid.extensions_vector_signature');
  end if;

  if vector_type_oid is not null and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_document_index_units_hybrid'
      and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_index_units_hybrid.extensions_vector_signature');
  end if;

  if to_regclass('public.document_index_units') is null then
    missing := array_append(missing, 'document_index_units.table');
  end if;
  if to_regclass('public.rag_retrieval_logs') is null then
    missing := array_append(missing, 'rag_retrieval_logs.table');
  end if;
  if not exists (select 1 from pg_class where relname = 'documents_title_trgm_idx') then
    missing := array_append(missing, 'documents_title_trgm_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_chunks_content_trgm_idx') then
    missing := array_append(missing, 'document_chunks_content_trgm_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_labels_label_trgm_idx') then
    missing := array_append(missing, 'document_labels_label_trgm_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_summaries_summary_trgm_idx') then
    missing := array_append(missing, 'document_summaries_summary_trgm_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_index_units_embedding_hnsw_idx') then
    missing := array_append(missing, 'document_index_units_embedding_hnsw_idx');
  end if;
  if not exists (select 1 from pg_class where relname in ('document_embedding_fields_owner_idx', 'document_embedding_fields_owner_id_idx')) then
    missing := array_append(missing, 'document_embedding_fields_owner_idx');
  end if;
  if not exists (select 1 from pg_class where relname in ('document_table_facts_owner_idx', 'document_table_facts_owner_id_idx')) then
    missing := array_append(missing, 'document_table_facts_owner_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_table_facts_source_image_idx') then
    missing := array_append(missing, 'document_table_facts_source_image_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_embedding_fields_dedup_idx') then
    missing := array_append(missing, 'document_embedding_fields_dedup_idx');
  end if;
  foreach index_name in array array[
    'document_pages_document_idx',
    'document_images_document_idx',
    'document_sections_document_idx',
    'document_memory_cards_document_idx',
    'document_chunks_document_idx',
    'document_table_facts_document_idx',
    'document_embedding_fields_document_idx',
    'document_index_units_document_idx',
    'ingestion_jobs_status_next_run_idx',
    'ingestion_jobs_document_status_idx',
    'documents_owner_status_idx',
    'import_batches_status_created_idx',
    'storage_cleanup_jobs_status_created_idx'
  ] loop
    if not exists (select 1 from pg_class where relname = index_name) then
      missing := array_append(missing, index_name);
    end if;
  end loop;

  return jsonb_build_object(
    'ok', cardinality(missing) = 0,
    'missing', missing,
    'vector_extension_schema', vector_schema,
    'checked_at', now()
  );
end;
$$;

revoke execute on function public.search_schema_health() from public, anon, authenticated;
grant execute on function public.search_schema_health() to service_role;

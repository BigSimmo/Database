create index if not exists document_pages_document_idx on public.document_pages(document_id, page_number);
create index if not exists document_images_document_idx on public.document_images(document_id, page_number);
create index if not exists document_sections_document_idx on public.document_sections(document_id, section_index);
create index if not exists document_memory_cards_document_idx
  on public.document_memory_cards(document_id, card_type, confidence desc);
create index if not exists document_chunks_document_idx on public.document_chunks(document_id, chunk_index);
create index if not exists document_table_facts_document_idx
  on public.document_table_facts(document_id, page_number);
create index if not exists document_embedding_fields_document_idx
  on public.document_embedding_fields(document_id, field_type);
create index if not exists document_index_units_document_idx
  on public.document_index_units(document_id, unit_type, page_start);
create index if not exists ingestion_jobs_status_next_run_idx
  on public.ingestion_jobs(status, next_run_at, created_at)
  where status in ('pending', 'processing', 'failed');
create index if not exists ingestion_jobs_document_status_idx
  on public.ingestion_jobs(document_id, status, created_at);
create index if not exists documents_owner_status_idx
  on public.documents(owner_id, status, updated_at desc);
create index if not exists import_batches_status_created_idx
  on public.import_batches(status, created_at desc)
  where status in ('queued', 'processing');
create index if not exists storage_cleanup_jobs_status_created_idx
  on public.storage_cleanup_jobs(status, created_at)
  where status in ('pending', 'failed');

create or replace function public.reset_document_index(p_document_id uuid)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  perform set_config('statement_timeout', '180000', true);
  delete from public.document_index_units where document_id = p_document_id;
  delete from public.document_memory_cards where document_id = p_document_id;
  delete from public.document_sections where document_id = p_document_id;
  delete from public.document_table_facts where document_id = p_document_id;
  delete from public.document_embedding_fields where document_id = p_document_id;
  delete from public.document_index_quality where document_id = p_document_id;
  delete from public.document_chunks where document_id = p_document_id;
  delete from public.document_images where document_id = p_document_id;
  delete from public.document_pages where document_id = p_document_id;
end;
$$;

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
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'match_document_chunks' and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_chunks.extensions_vector_signature');
  end if;

  if vector_type_oid is not null and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'match_document_chunks_hybrid' and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_chunks_hybrid.extensions_vector_signature');
  end if;

  if vector_type_oid is not null and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'match_document_memory_cards_hybrid' and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_memory_cards_hybrid.extensions_vector_signature');
  end if;

  if vector_type_oid is not null and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'match_document_index_units_hybrid' and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_index_units_hybrid.extensions_vector_signature');
  end if;

  if to_regclass('public.document_index_units') is null then
    missing := array_append(missing, 'document_index_units.table');
  end if;

  foreach index_name in array array[
    'documents_title_trgm_idx',
    'document_chunks_content_trgm_idx',
    'document_labels_label_trgm_idx',
    'document_summaries_summary_trgm_idx',
    'document_index_units_embedding_hnsw_idx',
    'document_embedding_fields_owner_idx',
    'document_table_facts_owner_idx',
    'document_table_facts_source_image_idx',
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
    'vector_extension_schema', (
      select n.nspname
      from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where t.typname = 'vector'
      limit 1
    ),
    'checked_at', now()
  );
end;
$$;

revoke execute on function public.search_schema_health() from public, anon, authenticated;
grant execute on function public.search_schema_health() to service_role;
grant execute on function public.reset_document_index(uuid) to service_role;

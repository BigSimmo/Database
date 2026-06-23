-- Reconcile live schema-health drift, vector index strategy, and RPC surface posture.
-- This migration is additive and safe to apply after existing history.

set search_path = public, extensions, pg_temp;

-- ============================================================
-- 1) Required indexes checked by health validation
-- ============================================================

create index if not exists documents_title_trgm_idx
  on public.documents using gin (lower(coalesce(title, '') || ' ' || coalesce(file_name, '')) gin_trgm_ops);

create index if not exists document_chunks_content_trgm_idx
  on public.document_chunks using gin (lower(coalesce(section_heading, '') || ' ' || coalesce(content, '')) gin_trgm_ops);

create index if not exists document_labels_label_trgm_idx
  on public.document_labels using gin (lower(label) gin_trgm_ops);

create index if not exists document_summaries_summary_trgm_idx
  on public.document_summaries using gin (left(summary, 2500) gin_trgm_ops);

create index if not exists rag_retrieval_logs_owner_created_idx
  on public.rag_retrieval_logs(owner_id, created_at desc);

create index if not exists rag_retrieval_logs_miss_idx
  on public.rag_retrieval_logs(is_miss, created_at desc)
  where is_miss = true;

create index if not exists rag_retrieval_logs_strategy_idx
  on public.rag_retrieval_logs(retrieval_strategy, created_at desc);

create index if not exists document_index_units_embedding_hnsw_idx
  on public.document_index_units using hnsw (embedding vector_cosine_ops)
  with (m = 24, ef_construction = 128);

create index if not exists document_table_facts_source_image_idx
  on public.document_table_facts(source_image_id)
  where source_image_id is not null;

create index if not exists document_pages_document_idx
  on public.document_pages(document_id, page_number);

create index if not exists document_sections_document_idx
  on public.document_sections(document_id, section_index);

create index if not exists document_chunks_document_idx
  on public.document_chunks(document_id, chunk_index);

-- ============================================================
-- 2) HNSW index reconciliation
--    Create missing HNSW index variants first. Legacy ivfflat cleanup is not automatic.
-- ============================================================

create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 24, ef_construction = 128);

-- document_embedding_fields is covered by the existing ivfflat index in this rollout.
-- Its HNSW replacement is intentionally deferred to a direct-connection maintenance window:
-- Supabase API/connector execution timed out before the long HNSW build could commit.

create or replace function public.detect_legacy_ivfflat_indexes()
returns text[]
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(array_agg(idx.relname order by idx.relname), array[]::text[])
  from pg_class idx
  join pg_index ix on ix.indexrelid = idx.oid
  join pg_class tab on tab.oid = ix.indrelid
  join pg_namespace tab_ns on tab_ns.oid = tab.relnamespace
  join pg_am am on idx.relam = am.oid
  where idx.relkind = 'i'
    and am.amname = 'ivfflat'
    and tab_ns.nspname = 'public'
    and tab.relname = any (
      array[
        'document_chunks',
        'document_embedding_fields',
        'document_index_units',
        'document_memory_cards',
        'document_table_facts'
      ]
    );
$$;

do $$
declare
  legacy_ivfflat_indexes text[];
begin
  select public.detect_legacy_ivfflat_indexes() into legacy_ivfflat_indexes;
  if array_length(legacy_ivfflat_indexes, 1) > 0 then
    raise notice
      'Legacy ivfflat vector indexes still present and should be reviewed for controlled deprecation: %',
      legacy_ivfflat_indexes;
  end if;
end $$;

-- ============================================================
-- 3) Add hardening for document_embedding_fields.content_hash
-- ============================================================

create or replace function public.set_document_embedding_field_content_hash()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    NEW.content_hash := md5(coalesce(NEW.content, ''));
  elsif tg_op = 'UPDATE' then
    if NEW.content_hash is null or NEW.content is distinct from OLD.content then
      NEW.content_hash := md5(coalesce(NEW.content, ''));
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists set_document_embedding_field_content_hash on public.document_embedding_fields;
create trigger set_document_embedding_field_content_hash
before insert or update
on public.document_embedding_fields
for each row
execute function public.set_document_embedding_field_content_hash();

update public.document_embedding_fields
set content_hash = md5(coalesce(content, ''))
where content_hash is null
   or content_hash = '';

create unique index if not exists document_embedding_fields_dedup_idx
  on public.document_embedding_fields(document_id, source_chunk_id, field_type, content_hash);

do $$
begin
  if exists (select 1 from public.document_embedding_fields where content_hash is null or content_hash = '') then
    raise notice 'document_embedding_fields content_hash backfill is incomplete; NOT NULL constraint deferred';
  else
    alter table public.document_embedding_fields
      alter column content_hash set not null;
  end if;
end $$;

-- ============================================================
-- 4) Runtime schema health check alignment
-- ============================================================

create or replace function public.search_schema_health()
returns jsonb
language plpgsql
stable
set search_path = public, extensions, pg_temp
as $$
declare
  missing text[] := array[]::text[];
  vector_type_oid oid;
  vector_schema text;
  index_name text;
  legacy_ivfflat_indexes text[];
  required_indexes constant text[] := array[
    'documents_title_trgm_idx',
    'document_chunks_content_trgm_idx',
    'document_labels_label_trgm_idx',
    'document_summaries_summary_trgm_idx',
    'document_index_units_embedding_hnsw_idx',
    'document_chunks_embedding_hnsw_idx',
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
  if to_regprocedure('public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_memory_cards_hybrid.extensions_vector_signature');
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

  select public.detect_legacy_ivfflat_indexes() into legacy_ivfflat_indexes;

  return jsonb_build_object(
    'ok', cardinality(missing) = 0,
    'missing', missing,
    'vector_extension_schema', vector_schema,
    'legacy_ivfflat_indexes', coalesce(legacy_ivfflat_indexes, array[]::text[]),
    'deferred_hnsw_indexes', array['document_embedding_fields_embedding_hnsw_idx'],
    'checked_at', now()
  );
end;
$$;

revoke execute on function public.search_schema_health() from public, anon, authenticated;
grant execute on function public.search_schema_health() to service_role;

-- ============================================================
-- 5) Restrict function execution to service-side pathways
-- ============================================================

do $$
begin
  if to_regprocedure('public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid)') is not null then
    revoke execute on function public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid) from public, anon, authenticated;
    grant execute on function public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid) to service_role;
  end if;
  if to_regprocedure('public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
    grant execute on function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
  end if;
  if to_regprocedure('public.match_document_chunks_text(text, integer, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_chunks_text(text, integer, uuid[], uuid) from public, anon, authenticated;
    grant execute on function public.match_document_chunks_text(text, integer, uuid[], uuid) to service_role;
  end if;
  if to_regprocedure('public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
    grant execute on function public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
  end if;
  if to_regprocedure('public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
    grant execute on function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
  end if;
  if to_regprocedure('public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
    grant execute on function public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
  end if;
  if to_regprocedure('public.match_documents_for_query(text, integer, uuid)') is not null then
    revoke execute on function public.match_documents_for_query(text, integer, uuid) from public, anon, authenticated;
    grant execute on function public.match_documents_for_query(text, integer, uuid) to service_role;
  end if;
  if to_regprocedure('public.match_document_table_facts_text(text, integer, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_table_facts_text(text, integer, uuid[], uuid) from public, anon, authenticated;
    grant execute on function public.match_document_table_facts_text(text, integer, uuid[], uuid) to service_role;
  end if;

  if to_regprocedure('public.analyze_rag_tables()') is not null then
    revoke execute on function public.analyze_rag_tables() from public, anon, authenticated;
    grant execute on function public.analyze_rag_tables() to service_role;
  end if;
  if to_regprocedure('public.claim_ingestion_jobs(text, integer, integer)') is not null then
    revoke execute on function public.claim_ingestion_jobs(text, integer, integer) from public, anon, authenticated;
    grant execute on function public.claim_ingestion_jobs(text, integer, integer) to service_role;
  end if;
  if to_regprocedure('public.refresh_import_batch_status(uuid)') is not null then
    revoke execute on function public.refresh_import_batch_status(uuid) from public, anon, authenticated;
    grant execute on function public.refresh_import_batch_status(uuid) to service_role;
  end if;
  if to_regprocedure('public.complete_ingestion_job(uuid, uuid, uuid, text)') is not null then
    revoke execute on function public.complete_ingestion_job(uuid, uuid, uuid, text) from public, anon, authenticated;
    grant execute on function public.complete_ingestion_job(uuid, uuid, uuid, text) to service_role;
  end if;
  if to_regprocedure('public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamptz)') is not null then
    revoke execute on function public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamptz) from public, anon, authenticated;
    grant execute on function public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamptz) to service_role;
  end if;
  if to_regprocedure('public.reset_document_index(uuid)') is not null then
    revoke execute on function public.reset_document_index(uuid) from public, anon, authenticated;
    grant execute on function public.reset_document_index(uuid) to service_role;
  end if;
  if to_regprocedure('public.stamp_document_deep_memory_version(uuid, text)') is not null then
    revoke execute on function public.stamp_document_deep_memory_version(uuid, text) from public, anon, authenticated;
    grant execute on function public.stamp_document_deep_memory_version(uuid, text) to service_role;
  end if;
end $$;

-- ============================================================
-- 6) Expand stats freshness scope for hot tables
-- ============================================================

create or replace function public.analyze_rag_tables()
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  table_names constant text[] := array[
    'documents',
    'document_chunks',
    'document_pages',
    'document_images',
    'document_sections',
    'document_memory_cards',
    'document_table_facts',
    'document_embedding_fields',
    'document_index_quality',
    'document_index_units',
    'rag_queries',
    'rag_query_misses',
    'rag_retrieval_logs',
    'rag_aliases',
    'ingestion_jobs'
  ];
  table_name text;
begin
  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('analyze public.%I', table_name);
    end if;
  end loop;
end;
$$;

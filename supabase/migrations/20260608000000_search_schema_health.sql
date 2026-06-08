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

  return jsonb_build_object(
    'ok', cardinality(missing) = 0,
    'missing', missing,
    'vector_extension_schema', vector_schema,
    'checked_at', now()
  );
end;
$$;

grant execute on function public.search_schema_health()
to service_role;

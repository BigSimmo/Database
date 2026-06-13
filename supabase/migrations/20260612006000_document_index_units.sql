create table if not exists public.document_index_units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid not null references public.documents(id) on delete cascade,
  unit_type text not null check (
    unit_type in (
      'document_profile',
      'section_summary',
      'page_text',
      'chunk_evidence',
      'table_fact',
      'askable_question',
      'clinical_fact',
      'vocabulary_term'
    )
  ),
  source_chunk_id uuid references public.document_chunks(id) on delete cascade,
  source_image_id uuid references public.document_images(id) on delete set null,
  page_start integer,
  page_end integer,
  heading_path text[] not null default '{}',
  title text not null,
  content text not null,
  normalized_terms text[] not null default '{}',
  source_span jsonb,
  quality_score real not null default 0.7 check (quality_score >= 0 and quality_score <= 1),
  extraction_mode text not null default 'deterministic'
    check (extraction_mode in ('deterministic', 'model_heavy', 'hybrid')),
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(unit_type, '') || ' ' ||
      coalesce(title, '') || ' ' ||
      coalesce(content, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_index_units_document_idx
  on public.document_index_units(document_id, unit_type, page_start);
create index if not exists document_index_units_owner_type_idx
  on public.document_index_units(owner_id, unit_type, quality_score desc);
create index if not exists document_index_units_chunk_idx
  on public.document_index_units(source_chunk_id)
  where source_chunk_id is not null;
create index if not exists document_index_units_image_idx
  on public.document_index_units(source_image_id)
  where source_image_id is not null;
create index if not exists document_index_units_terms_idx
  on public.document_index_units using gin(normalized_terms);
create index if not exists document_index_units_heading_path_idx
  on public.document_index_units using gin(heading_path);
create index if not exists document_index_units_search_idx
  on public.document_index_units using gin(search_tsv);
create index if not exists document_index_units_embedding_hnsw_idx
  on public.document_index_units using hnsw (embedding vector_cosine_ops);

create index if not exists document_embedding_fields_owner_idx
  on public.document_embedding_fields(owner_id);
create index if not exists document_table_facts_owner_idx
  on public.document_table_facts(owner_id);
create index if not exists document_table_facts_source_image_idx
  on public.document_table_facts(source_image_id)
  where source_image_id is not null;

alter table public.document_memory_cards
  drop constraint if exists document_memory_cards_card_type_check;

alter table public.document_memory_cards
  add constraint document_memory_cards_card_type_check
  check (card_type in (
    'section_summary',
    'askable_question',
    'table_row',
    'threshold',
    'medication',
    'risk',
    'workflow',
    'definition',
    'citation_anchor'
  ));

drop trigger if exists document_index_units_updated_at on public.document_index_units;
create trigger document_index_units_updated_at
before update on public.document_index_units
for each row execute function public.set_updated_at();

create or replace function public.match_document_index_units_hybrid(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 24,
  min_similarity double precision default 0.1,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  source_chunk_id uuid,
  source_image_id uuid,
  unit_type text,
  title text,
  content text,
  page_start integer,
  page_end integer,
  heading_path text[],
  normalized_terms text[],
  source_span jsonb,
  quality_score real,
  extraction_mode text,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  metadata jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      regexp_split_to_array(lower(coalesce(query_text, '')), '\s+') as terms
  ),
  ranked as (
    select
      u.id,
      u.document_id,
      u.source_chunk_id,
      u.source_image_id,
      u.unit_type,
      u.title,
      u.content,
      u.page_start,
      u.page_end,
      u.heading_path,
      u.normalized_terms,
      u.source_span,
      u.quality_score,
      u.extraction_mode,
      (1 - (u.embedding <=> query_embedding))::double precision as similarity,
      (
        ts_rank_cd(u.search_tsv, query.tsq) +
        case when u.normalized_terms && query.terms then 0.25 else 0 end +
        case
          when u.unit_type in ('askable_question', 'table_fact', 'clinical_fact') then 0.06
          when u.unit_type = 'section_summary' then 0.03
          else 0
        end
      )::double precision as text_rank,
      u.metadata
    from public.document_index_units u
    join public.documents d on d.id = u.document_id
    cross join query
    where d.status = 'indexed'
      and (document_filters is null or u.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and u.source_chunk_id is not null
      and (u.search_tsv @@ query.tsq or u.normalized_terms && query.terms)
    order by text_rank desc, similarity desc
    limit greatest(match_count * 3, 48)
  )
  select
    id,
    document_id,
    source_chunk_id,
    source_image_id,
    unit_type,
    title,
    content,
    page_start,
    page_end,
    heading_path,
    normalized_terms,
    source_span,
    quality_score,
    extraction_mode,
    similarity,
    text_rank,
    ((similarity * 0.58) + (least(text_rank, 1) * 0.32) + (quality_score * 0.1))::double precision as hybrid_score,
    metadata
  from ranked
  order by hybrid_score desc, similarity desc, text_rank desc
  limit match_count;
$$;

create or replace function public.reset_document_index(p_document_id uuid)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
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
  if not exists (select 1 from pg_class where relname = 'document_embedding_fields_owner_idx') then
    missing := array_append(missing, 'document_embedding_fields_owner_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_table_facts_owner_idx') then
    missing := array_append(missing, 'document_table_facts_owner_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_table_facts_source_image_idx') then
    missing := array_append(missing, 'document_table_facts_source_image_idx');
  end if;

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

alter table public.document_index_units enable row level security;

grant select, insert, update, delete on table public.document_index_units to service_role;
grant select on table public.document_index_units to authenticated;
grant execute on function public.match_document_index_units_hybrid(
  extensions.vector,
  text,
  integer,
  double precision,
  uuid[],
  uuid
) to service_role;

drop policy if exists "document index units owner read" on public.document_index_units;
create policy "document index units owner read" on public.document_index_units
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

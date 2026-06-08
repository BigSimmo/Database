alter table public.document_chunks
  add column if not exists section_path text[] not null default '{}',
  add column if not exists heading_level integer,
  add column if not exists parent_heading text,
  add column if not exists anchor_id text;

create index if not exists document_chunks_section_path_gin_idx
  on public.document_chunks using gin(section_path);
create index if not exists document_chunks_anchor_idx
  on public.document_chunks(document_id, anchor_id)
  where anchor_id is not null;

create table if not exists public.document_table_facts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_chunk_id uuid references public.document_chunks(id) on delete cascade,
  source_image_id uuid references public.document_images(id) on delete set null,
  page_number integer,
  table_title text,
  row_label text,
  clinical_parameter text,
  threshold_value text,
  action text,
  normalized_terms text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(table_title, '') || ' ' ||
      coalesce(row_label, '') || ' ' ||
      coalesce(clinical_parameter, '') || ' ' ||
      coalesce(threshold_value, '') || ' ' ||
      coalesce(action, '')
    )
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists document_table_facts_document_idx
  on public.document_table_facts(document_id, page_number);
create index if not exists document_table_facts_chunk_idx
  on public.document_table_facts(source_chunk_id);
create index if not exists document_table_facts_search_idx
  on public.document_table_facts using gin(search_tsv);
create index if not exists document_table_facts_terms_idx
  on public.document_table_facts using gin(normalized_terms);

create table if not exists public.document_embedding_fields (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_chunk_id uuid references public.document_chunks(id) on delete cascade,
  field_type text not null check (field_type in ('document_title', 'document_summary', 'section_context', 'memory_card')),
  content text not null,
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, source_chunk_id, field_type, content)
);

create index if not exists document_embedding_fields_document_idx
  on public.document_embedding_fields(document_id, field_type);
create index if not exists document_embedding_fields_chunk_idx
  on public.document_embedding_fields(source_chunk_id)
  where source_chunk_id is not null;
create index if not exists document_embedding_fields_search_idx
  on public.document_embedding_fields using gin(search_tsv);
create index if not exists document_embedding_fields_embedding_hnsw_idx
  on public.document_embedding_fields using hnsw (embedding vector_cosine_ops);

create table if not exists public.document_index_quality (
  document_id uuid primary key references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  quality_score real not null default 0 check (quality_score >= 0 and quality_score <= 1),
  extraction_quality text not null default 'unknown'
    check (extraction_quality in ('good', 'partial', 'poor', 'unknown')),
  metrics jsonb not null default '{}'::jsonb,
  issues text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists document_index_quality_owner_score_idx
  on public.document_index_quality(owner_id, quality_score, updated_at desc);

create table if not exists public.rag_query_misses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  query text not null,
  normalized_query text not null,
  query_class text,
  route text,
  retrieval_strategy text,
  top_score double precision,
  top_files text[] not null default '{}',
  top_chunk_ids uuid[] not null default '{}',
  expected_file text,
  clicked_document_id uuid,
  clicked_chunk_id uuid,
  cited_chunk_ids uuid[] not null default '{}',
  miss_reason text not null default 'weak_search',
  candidate_aliases text[] not null default '{}',
  candidate_labels jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  promoted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rag_query_misses_owner_created_idx
  on public.rag_query_misses(owner_id, created_at desc);
create index if not exists rag_query_misses_normalized_idx
  on public.rag_query_misses(normalized_query, created_at desc);
create index if not exists rag_query_misses_aliases_idx
  on public.rag_query_misses using gin(candidate_aliases);

create or replace function public.match_document_table_facts_text(
  query_text text,
  match_count integer default 16,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  source_chunk_id uuid,
  source_image_id uuid,
  page_number integer,
  table_title text,
  row_label text,
  clinical_parameter text,
  threshold_value text,
  action text,
  text_rank double precision,
  match_reason text
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      lower(coalesce(query_text, '')) as normalized
  ),
  ranked as (
    select
      f.id,
      f.document_id,
      f.source_chunk_id,
      f.source_image_id,
      f.page_number,
      f.table_title,
      f.row_label,
      f.clinical_parameter,
      f.threshold_value,
      f.action,
      (
        ts_rank_cd(f.search_tsv, query.tsq) +
        (similarity(lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')), query.normalized) * 0.8)
      )::double precision as text_rank,
      case
        when coalesce(f.threshold_value, '') <> '' then 'table_threshold'
        when coalesce(f.action, '') <> '' then 'table_action'
        else 'table_row'
      end as match_reason
    from public.document_table_facts f
    join public.documents d on d.id = f.document_id
    cross join query
    where (document_filters is null or f.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and (
        f.search_tsv @@ query.tsq
        or f.normalized_terms && regexp_split_to_array(query.normalized, '\s+')
        or similarity(lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')), query.normalized) >= 0.18
      )
  )
  select *
  from ranked
  where text_rank > 0
  order by text_rank desc, page_number asc nulls last
  limit match_count;
$$;

create or replace function public.match_document_embedding_fields_hybrid(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 16,
  min_similarity double precision default 0.1,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  source_chunk_id uuid,
  field_type text,
  content text,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  ranked as (
    select
      f.id,
      f.document_id,
      f.source_chunk_id,
      f.field_type,
      f.content,
      (1 - (f.embedding <=> query_embedding))::double precision as similarity,
      ts_rank_cd(f.search_tsv, query.tsq)::double precision as text_rank
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    cross join query
    where (document_filters is null or f.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and f.source_chunk_id is not null
      and (
        1 - (f.embedding <=> query_embedding) >= min_similarity
        or f.search_tsv @@ query.tsq
      )
    order by
      ((1 - (f.embedding <=> query_embedding)) * 0.7 + least(ts_rank_cd(f.search_tsv, query.tsq), 1) * 0.3) desc
    limit greatest(match_count * 3, 32)
  )
  select
    id,
    document_id,
    source_chunk_id,
    field_type,
    content,
    similarity,
    text_rank,
    ((similarity * 0.7) + (least(text_rank, 1) * 0.3))::double precision as hybrid_score
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

alter table public.document_table_facts enable row level security;
alter table public.document_embedding_fields enable row level security;
alter table public.document_index_quality enable row level security;
alter table public.rag_query_misses enable row level security;

grant select, insert, update, delete on table
  public.document_table_facts,
  public.document_embedding_fields,
  public.document_index_quality,
  public.rag_query_misses
to service_role;

grant select on table
  public.document_table_facts,
  public.document_embedding_fields,
  public.document_index_quality,
  public.rag_query_misses
to authenticated;

drop policy if exists "table facts owner read" on public.document_table_facts;
create policy "table facts owner read" on public.document_table_facts
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

drop policy if exists "embedding fields owner read" on public.document_embedding_fields;
create policy "embedding fields owner read" on public.document_embedding_fields
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

drop policy if exists "index quality owner read" on public.document_index_quality;
create policy "index quality owner read" on public.document_index_quality
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "rag misses owner read" on public.rag_query_misses;
create policy "rag misses owner read" on public.rag_query_misses
  for select to authenticated using (owner_id = (select auth.uid()));

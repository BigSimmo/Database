create table if not exists public.rag_response_cache (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  cache_kind text not null check (cache_kind in ('search', 'answer')),
  scope_key text not null,
  normalized_query text not null,
  indexing_version text not null default 'rag-deep-memory-v1',
  dependency_version text not null default 'rag-cache-v1',
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_title_trgm_idx
  on public.documents using gin ((lower(coalesce(title, '') || ' ' || coalesce(file_name, ''))) gin_trgm_ops);
create index if not exists document_labels_label_trgm_idx
  on public.document_labels using gin ((lower(label)) gin_trgm_ops);
create index if not exists document_summaries_summary_trgm_idx
  on public.document_summaries using gin ((lower(summary)) gin_trgm_ops);
create index if not exists rag_response_cache_expiry_idx
  on public.rag_response_cache(expires_at);
create index if not exists rag_response_cache_owner_kind_idx
  on public.rag_response_cache(owner_id, cache_kind, updated_at desc);
create unique index if not exists rag_response_cache_key_idx
  on public.rag_response_cache(
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    cache_kind,
    scope_key,
    normalized_query,
    indexing_version,
    dependency_version
  );

drop trigger if exists rag_response_cache_updated_at on public.rag_response_cache;
create trigger rag_response_cache_updated_at
before update on public.rag_response_cache
for each row execute function public.set_updated_at();

alter table public.rag_response_cache enable row level security;
grant all on table public.rag_response_cache to service_role;

create or replace function public.document_label_metadata(p_document_id uuid)
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'document_id', l.document_id,
        'owner_id', l.owner_id,
        'label', l.label,
        'label_type', l.label_type,
        'source', l.source,
        'confidence', l.confidence,
        'metadata', l.metadata,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      )
      order by l.confidence desc, l.label
    ),
    '[]'::jsonb
  )
  from public.document_labels l
  where l.document_id = p_document_id;
$$;

create or replace function public.document_summary_text(p_document_id uuid)
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select s.summary
  from public.document_summaries s
  where s.document_id = p_document_id
  limit 1;
$$;

drop function if exists public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid);
drop function if exists public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid);
drop function if exists public.match_document_chunks_text(text, integer, uuid[], uuid);

create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  min_similarity double precision default 0.15,
  document_filter uuid default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  file_name text,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  image_ids uuid[],
  source_metadata jsonb,
  document_labels jsonb,
  document_summary text,
  similarity double precision,
  images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    c.id,
    c.document_id,
    d.title,
    d.file_name,
    c.page_number,
    c.chunk_index,
    c.section_heading,
    c.content,
    c.image_ids,
    d.metadata as source_metadata,
    coalesce(public.document_label_metadata(c.document_id), '[]'::jsonb) as document_labels,
    public.document_summary_text(c.document_id) as document_summary,
    1 - (c.embedding <=> query_embedding) as similarity,
    public.chunk_image_metadata(c.image_ids) as images
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where (document_filter is null or c.document_id = document_filter)
    and (owner_filter is null or d.owner_id = owner_filter)
    and d.status = 'indexed'
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_document_chunks_hybrid(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 12,
  min_similarity double precision default 0.12,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  file_name text,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  image_ids uuid[],
  source_metadata jsonb,
  document_labels jsonb,
  document_summary text,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  rrf_score double precision,
  images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  vector_ranked as (
    select
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0))::double precision as text_rank,
      row_number() over (order by c.embedding <=> query_embedding) as vector_rank,
      null::bigint as text_match_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding
    limit greatest(match_count * 6, 48)
  ),
  text_ranked as (
    select
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0))::double precision as text_rank,
      null::bigint as vector_rank,
      row_number() over (
        order by (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)) desc, c.embedding <=> query_embedding
      ) as text_match_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)) desc
    limit greatest(match_count * 6, 48)
  ),
  scored as (
    select
      id,
      document_id,
      page_number,
      chunk_index,
      section_heading,
      content,
      image_ids,
      max(similarity)::double precision as similarity,
      max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank,
      min(text_match_rank) as text_match_rank
    from (
      select * from vector_ranked
      union all
      select * from text_ranked
    ) combined
    group by id, document_id, page_number, chunk_index, section_heading, content, image_ids
  )
  select
    c.id,
    c.document_id,
    d.title,
    d.file_name,
    c.page_number,
    c.chunk_index,
    c.section_heading,
    c.content,
    c.image_ids,
    d.metadata as source_metadata,
    coalesce(public.document_label_metadata(c.document_id), '[]'::jsonb) as document_labels,
    public.document_summary_text(c.document_id) as document_summary,
    c.similarity,
    c.text_rank,
    ((c.similarity * 0.72) + (least(c.text_rank, 1) * 0.28))::double precision as hybrid_score,
    (coalesce(1.0 / (60 + c.vector_rank), 0) + coalesce(1.0 / (60 + c.text_match_rank), 0))::double precision as rrf_score,
    public.chunk_image_metadata(c.image_ids) as images
  from scored c
  join public.documents d on d.id = c.document_id
  order by hybrid_score desc, c.similarity desc, c.text_rank desc
  limit match_count;
$$;

create or replace function public.match_document_chunks_text(
  query_text text,
  match_count integer default 12,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  file_name text,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  image_ids uuid[],
  source_metadata jsonb,
  document_labels jsonb,
  document_summary text,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  images jsonb
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
      c.id,
      c.document_id,
      d.title,
      d.file_name,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.image_ids,
      d.metadata as source_metadata,
      (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0))::double precision as text_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)) desc
    limit greatest(match_count * 5, 48)
  )
  select
    ranked.id,
    ranked.document_id,
    ranked.title,
    ranked.file_name,
    ranked.page_number,
    ranked.chunk_index,
    ranked.section_heading,
    ranked.content,
    ranked.image_ids,
    ranked.source_metadata,
    coalesce(public.document_label_metadata(ranked.document_id), '[]'::jsonb) as document_labels,
    public.document_summary_text(ranked.document_id) as document_summary,
    least(0.95, 0.56 + (least(ranked.text_rank, 1) * 0.39))::double precision as similarity,
    ranked.text_rank,
    least(0.97, 0.58 + (least(ranked.text_rank, 1) * 0.39))::double precision as hybrid_score,
    public.chunk_image_metadata(ranked.image_ids) as images
  from ranked
  order by hybrid_score desc, text_rank desc
  limit match_count;
$$;

create or replace function public.match_document_memory_cards_hybrid(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 32,
  min_similarity double precision default 0.1,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  owner_id uuid,
  section_id uuid,
  card_type text,
  title text,
  content text,
  normalized_terms text[],
  page_number integer,
  source_chunk_ids uuid[],
  source_image_ids uuid[],
  confidence real,
  metadata jsonb,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  rrf_score double precision
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  vector_ranked as (
    select
      m.*,
      1 - (m.embedding <=> query_embedding) as similarity,
      ts_rank_cd(m.search_tsv, query.tsq)::double precision as text_rank,
      row_number() over (order by m.embedding <=> query_embedding) as vector_rank,
      null::bigint as text_match_rank
    from public.document_memory_cards m
    join public.documents d on d.id = m.document_id
    cross join query
    where (document_filters is null or m.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and 1 - (m.embedding <=> query_embedding) >= min_similarity
    order by m.embedding <=> query_embedding
    limit greatest(match_count * 4, 64)
  ),
  text_ranked as (
    select
      m.*,
      1 - (m.embedding <=> query_embedding) as similarity,
      ts_rank_cd(m.search_tsv, query.tsq)::double precision as text_rank,
      null::bigint as vector_rank,
      row_number() over (
        order by ts_rank_cd(m.search_tsv, query.tsq) desc, m.embedding <=> query_embedding
      ) as text_match_rank
    from public.document_memory_cards m
    join public.documents d on d.id = m.document_id
    cross join query
    where (document_filters is null or m.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and m.search_tsv @@ query.tsq
    order by ts_rank_cd(m.search_tsv, query.tsq) desc
    limit greatest(match_count * 4, 64)
  ),
  scored as (
    select
      id,
      document_id,
      owner_id,
      section_id,
      card_type,
      title,
      content,
      normalized_terms,
      page_number,
      source_chunk_ids,
      source_image_ids,
      confidence,
      metadata,
      max(similarity)::double precision as similarity,
      max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank,
      min(text_match_rank) as text_match_rank
    from (
      select * from vector_ranked
      union all
      select * from text_ranked
    ) combined
    group by
      id,
      document_id,
      owner_id,
      section_id,
      card_type,
      title,
      content,
      normalized_terms,
      page_number,
      source_chunk_ids,
      source_image_ids,
      confidence,
      metadata
  )
  select
    id,
    document_id,
    owner_id,
    section_id,
    card_type,
    title,
    content,
    normalized_terms,
    page_number,
    source_chunk_ids,
    source_image_ids,
    confidence,
    metadata,
    similarity,
    text_rank,
    ((similarity * 0.65) + (least(text_rank, 1) * 0.25) + (confidence * 0.10))::double precision as hybrid_score,
    (coalesce(1.0 / (60 + vector_rank), 0) + coalesce(1.0 / (60 + text_match_rank), 0))::double precision as rrf_score
  from scored
  order by hybrid_score desc, similarity desc, text_rank desc, confidence desc
  limit match_count;
$$;

create or replace function public.match_documents_for_query(
  query_text text,
  match_count integer default 12,
  owner_filter uuid default null
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  file_name text,
  status text,
  page_count integer,
  chunk_count integer,
  image_count integer,
  metadata jsonb,
  text_rank double precision,
  match_reason text
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq, lower(coalesce(query_text, '')) as normalized
  ),
  ranked as (
    select
      d.id,
      d.owner_id,
      d.title,
      d.file_name,
      d.status,
      d.page_count,
      d.chunk_count,
      d.image_count,
      d.metadata,
      (
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 4.0) +
        (ts_rank_cd(d.search_tsv, query.tsq) * 1.5) +
        coalesce(max(ts_rank_cd(to_tsvector('english', l.label), query.tsq)) * 1.2, 0) +
        coalesce(ts_rank_cd(to_tsvector('english', s.summary), query.tsq), 0) +
        (greatest(
          similarity(lower(coalesce(d.title, '') || ' ' || coalesce(d.file_name, '')), query.normalized),
          coalesce(max(similarity(lower(l.label), query.normalized)), 0),
          coalesce(similarity(lower(s.summary), query.normalized), 0)
        ) * 1.6)
      )::double precision as text_rank,
      case
        when d.title_search_tsv @@ query.tsq then 'title'
        when max(l.label) filter (where to_tsvector('english', l.label) @@ query.tsq) is not null then 'label'
        when s.summary is not null and to_tsvector('english', s.summary) @@ query.tsq then 'summary'
        when similarity(lower(coalesce(d.title, '') || ' ' || coalesce(d.file_name, '')), query.normalized) >= 0.18 then 'fuzzy_title'
        when d.search_tsv @@ query.tsq then 'metadata'
        else 'none'
      end as match_reason
    from public.documents d
    left join public.document_labels l on l.document_id = d.id
    left join public.document_summaries s on s.document_id = d.id
    cross join query
    where (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and (
        d.title_search_tsv @@ query.tsq
        or d.search_tsv @@ query.tsq
        or to_tsvector('english', coalesce(l.label, '')) @@ query.tsq
        or to_tsvector('english', coalesce(s.summary, '')) @@ query.tsq
        or similarity(lower(coalesce(d.title, '') || ' ' || coalesce(d.file_name, '')), query.normalized) >= 0.18
        or similarity(lower(coalesce(l.label, '')), query.normalized) >= 0.2
        or similarity(lower(coalesce(s.summary, '')), query.normalized) >= 0.16
      )
    group by d.id, d.owner_id, d.title, d.file_name, d.status, d.page_count, d.chunk_count, d.image_count, d.metadata, s.summary, query.tsq, query.normalized
  )
  select *
  from ranked
  where text_rank > 0
  order by text_rank desc, page_count desc, title asc
  limit match_count;
$$;

grant execute on function public.document_label_metadata(uuid) to service_role;
grant execute on function public.document_summary_text(uuid) to service_role;
grant execute on function public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid) to service_role;
grant execute on function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
grant execute on function public.match_document_chunks_text(text, integer, uuid[], uuid) to service_role;
grant execute on function public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
grant execute on function public.match_documents_for_query(text, integer, uuid) to service_role;

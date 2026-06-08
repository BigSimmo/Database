drop function if exists public.match_document_chunks_hybrid(vector, text, integer, double precision, uuid[], uuid);

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
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
      )::double precision as text_rank,
      row_number() over (order by c.embedding <=> query_embedding) as vector_rank,
      null::bigint as text_match_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
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
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
      )::double precision as text_rank,
      null::bigint as vector_rank,
      row_number() over (
        order by
          (
            ts_rank_cd(c.search_tsv, query.tsq) +
            (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
          ) desc,
          c.embedding <=> query_embedding
      ) as text_match_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit greatest(match_count * 6, 48)
  ),
  combined as (
    select * from vector_ranked
    union all
    select * from text_ranked
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
    from combined
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
    c.similarity,
    c.text_rank,
    ((c.similarity * 0.72) + (least(c.text_rank, 1) * 0.28))::double precision as hybrid_score,
    (
      coalesce(1.0 / (60 + c.vector_rank), 0) +
      coalesce(1.0 / (60 + c.text_match_rank), 0)
    )::double precision as rrf_score,
    public.chunk_image_metadata(c.image_ids) as images
  from scored c
  join public.documents d on d.id = c.document_id
  order by hybrid_score desc, c.similarity desc, c.text_rank desc
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
      and m.search_tsv @@ query.tsq
    order by ts_rank_cd(m.search_tsv, query.tsq) desc
    limit greatest(match_count * 4, 64)
  ),
  combined as (
    select * from vector_ranked
    union all
    select * from text_ranked
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
    from combined
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
    (
      coalesce(1.0 / (60 + vector_rank), 0) +
      coalesce(1.0 / (60 + text_match_rank), 0)
    )::double precision as rrf_score
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
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
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
        (ts_rank_cd(d.search_tsv, query.tsq) * 1.5)
      )::double precision as text_rank,
      case
        when d.title_search_tsv @@ query.tsq then 'title'
        when d.search_tsv @@ query.tsq then 'metadata'
        else 'none'
      end as match_reason
    from public.documents d
    cross join query
    where (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and (d.title_search_tsv @@ query.tsq or d.search_tsv @@ query.tsq)
  )
  select *
  from ranked
  where text_rank > 0
  order by text_rank desc, page_count desc, title asc
  limit match_count;
$$;

revoke execute on function public.match_document_chunks_hybrid(vector, text, integer, double precision, uuid[], uuid)
  from anon, authenticated, public;
revoke execute on function public.match_document_memory_cards_hybrid(vector, text, integer, double precision, uuid[], uuid)
  from anon, authenticated, public;
revoke execute on function public.match_documents_for_query(text, integer, uuid)
  from anon, authenticated, public;

grant execute on function public.match_document_chunks_hybrid(vector, text, integer, double precision, uuid[], uuid)
  to service_role;
grant execute on function public.match_document_memory_cards_hybrid(vector, text, integer, double precision, uuid[], uuid)
  to service_role;
grant execute on function public.match_documents_for_query(text, integer, uuid)
  to service_role;

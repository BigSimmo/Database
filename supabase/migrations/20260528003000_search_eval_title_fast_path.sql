alter table public.documents
  add column if not exists search_tsv tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(file_name, ''))
  ) stored;

create index if not exists documents_search_idx on public.documents using gin(search_tsv);

create or replace function public.match_document_chunks_hybrid(
  query_embedding vector(1536),
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
  images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  vector_candidates as (
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
        (ts_rank_cd(d.search_tsv, query.tsq) * 1.5)
      )::double precision as text_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding
    limit greatest(match_count * 6, 48)
  ),
  text_candidates as (
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
        (ts_rank_cd(d.search_tsv, query.tsq) * 1.5)
      )::double precision as text_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and (c.search_tsv @@ query.tsq or d.search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.search_tsv, query.tsq) * 1.5)
    ) desc
    limit greatest(match_count * 6, 48)
  ),
  combined as (
    select * from vector_candidates
    union
    select * from text_candidates
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
    public.chunk_image_metadata(c.image_ids) as images
  from combined c
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
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.search_tsv, query.tsq) * 1.5)
      )::double precision as text_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and (c.search_tsv @@ query.tsq or d.search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.search_tsv, query.tsq) * 1.5)
    ) desc
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
    least(0.95, 0.56 + (least(ranked.text_rank, 1) * 0.39))::double precision as similarity,
    ranked.text_rank,
    least(0.97, 0.58 + (least(ranked.text_rank, 1) * 0.39))::double precision as hybrid_score,
    public.chunk_image_metadata(ranked.image_ids) as images
  from ranked
  order by hybrid_score desc, text_rank desc
  limit match_count;
$$;

create or replace function public.get_related_document_metadata(
  document_ids uuid[],
  owner_filter uuid default null
)
returns table (
  document_id uuid,
  labels jsonb,
  summary text
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    d.id as document_id,
    coalesce(
      (
        select jsonb_agg(
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
        )
        from public.document_labels l
        where l.document_id = d.id
          and (owner_filter is null or l.owner_id = owner_filter)
      ),
      '[]'::jsonb
    ) as labels,
    (
      select s.summary
      from public.document_summaries s
      where s.document_id = d.id
        and (owner_filter is null or s.owner_id = owner_filter)
      order by s.generated_at desc
      limit 1
    ) as summary
  from public.documents d
  where d.id = any(document_ids)
    and (owner_filter is null or d.owner_id = owner_filter);
$$;

grant execute on all functions in schema public to service_role;

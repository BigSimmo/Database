alter table public.document_chunks
  add column if not exists retrieval_synopsis text;

drop index if exists public.document_chunks_search_idx;
alter table public.document_chunks drop column if exists search_tsv;
alter table public.document_chunks
  add column search_tsv tsvector generated always as (
    to_tsvector('english', coalesce(section_heading, '') || ' ' || coalesce(retrieval_synopsis, '') || ' ' || content)
  ) stored;
create index if not exists document_chunks_search_idx on public.document_chunks using gin(search_tsv);

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
  retrieval_synopsis text,
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
    c.retrieval_synopsis,
    c.image_ids,
    d.metadata as source_metadata,
    '[]'::jsonb as document_labels,
    null::text as document_summary,
    1 - (c.embedding <=> query_embedding) as similarity,
    '[]'::jsonb as images
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
  retrieval_synopsis text,
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
      c.retrieval_synopsis,
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
      c.retrieval_synopsis,
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
      and d.status = 'indexed'
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
      retrieval_synopsis,
      image_ids,
      max(similarity)::double precision as similarity,
      max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank,
      min(text_match_rank) as text_match_rank
    from combined
    group by id, document_id, page_number, chunk_index, section_heading, content, retrieval_synopsis, image_ids
  ),
  scored_metrics as (
    select
      scored.*,
      ((scored.similarity * 0.72) + (least(scored.text_rank, 1) * 0.28))::double precision as hybrid_score,
      (
        coalesce(1.0 / (60 + scored.vector_rank), 0) +
        coalesce(1.0 / (60 + scored.text_match_rank), 0)
      )::double precision as rrf_score
    from scored
  ),
  candidate_ids as (
    select id from (select id from scored_metrics order by hybrid_score desc, similarity desc, text_rank desc limit match_count) hybrid_candidates
    union
    select id from (select id from scored_metrics order by similarity desc, hybrid_score desc limit match_count) vector_candidates
    union
    select id from (select id from scored_metrics order by text_rank desc, hybrid_score desc limit match_count) text_candidates
    union
    select id from (select id from scored_metrics order by rrf_score desc, hybrid_score desc limit match_count) rrf_candidates
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
    c.retrieval_synopsis,
    c.image_ids,
    d.metadata as source_metadata,
    c.similarity,
    c.text_rank,
    c.hybrid_score,
    c.rrf_score,
    public.chunk_image_metadata(c.image_ids) as images
  from scored_metrics c
  join candidate_ids candidates on candidates.id = c.id
  join public.documents d on d.id = c.document_id
  order by c.hybrid_score desc, c.rrf_score desc, c.similarity desc, c.text_rank desc
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
  retrieval_synopsis text,
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
      c.retrieval_synopsis,
      c.image_ids,
      d.metadata as source_metadata,
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
      )::double precision as text_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
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
    ranked.retrieval_synopsis,
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

grant execute on function public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid) to service_role;
grant execute on function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
grant execute on function public.match_document_chunks_text(text, integer, uuid[], uuid) to service_role;
grant execute on function public.document_label_metadata(uuid) to service_role;
grant execute on function public.document_summary_text(uuid) to service_role;

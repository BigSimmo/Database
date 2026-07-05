-- Public-only retrieval owner filter sentinel for hybrid RPCs.
set search_path = public, extensions, pg_temp;

create or replace function public.retrieval_owner_matches(owner_filter uuid, row_owner_id uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $
  select case
    when owner_filter is null then true
    when owner_filter = '00000000-0000-0000-0000-000000000000'::uuid then row_owner_id is null
    else row_owner_id = owner_filter or row_owner_id is null
  end;
$;

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
    and public.retrieval_owner_matches(owner_filter, d.owner_id)
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.metadata)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

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
    and public.retrieval_owner_matches(owner_filter, d.owner_id)
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.metadata)
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
      null::bigint as text_match_rank,
      coalesce((d.metadata->'rag_indexing_version') is not null, false) as has_deep_index,
      d.updated_at as doc_updated_at,
      coalesce(
        (select q.quality_score from public.document_index_quality q where q.document_id = c.document_id),
        0.7
      ) as quality_score
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.metadata)
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
      ) as text_match_rank,
      coalesce((d.metadata->'rag_indexing_version') is not null, false) as has_deep_index,
      d.updated_at as doc_updated_at,
      coalesce(
        (select q.quality_score from public.document_index_quality q where q.document_id = c.document_id),
        0.7
      ) as quality_score
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.metadata)
      and c.search_tsv @@ query.tsq
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
      min(text_match_rank) as text_match_rank,
      max(quality_score)::double precision as quality_score,
      bool_or(has_deep_index) as has_deep_index,
      max(doc_updated_at) as doc_updated_at
    from combined
    group by id, document_id, page_number, chunk_index, section_heading, content, retrieval_synopsis, image_ids
  ),
  scored_metrics as (
    select
      scored.*,
      (
        (scored.similarity * 0.62)
        + (least(scored.text_rank, 1) * 0.22)
        + (scored.quality_score * 0.10)
        + (case when scored.doc_updated_at > now() - interval '90 days' then 0.06 else 0 end)
      )::double precision as hybrid_score,
      (
        coalesce(1.0 / (60 + scored.vector_rank), 0) +
        coalesce(1.0 / (60 + scored.text_match_rank), 0)
      )::double precision as rrf_score
    from scored
  ),
  hybrid_candidates as (
    select id
    from scored_metrics
    order by hybrid_score desc, similarity desc, text_rank desc
    limit match_count
  ),
  vector_candidates as (
    select id
    from scored_metrics
    order by similarity desc, hybrid_score desc
    limit match_count
  ),
  text_candidates as (
    select id
    from scored_metrics
    order by text_rank desc, hybrid_score desc
    limit match_count
  ),
  rrf_candidates as (
    select id
    from scored_metrics
    order by rrf_score desc, hybrid_score desc
    limit match_count
  ),
  candidate_ids as (
    select id from hybrid_candidates
    union
    select id from vector_candidates
    union
    select id from text_candidates
    union
    select id from rrf_candidates
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

create or replace function public.match_document_memory_cards_hybrid_v2(
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
      (1 - (m.embedding <=> query_embedding))::double precision as similarity,
      ts_rank_cd(m.search_tsv, query.tsq)::double precision as text_rank,
      row_number() over (order by m.embedding <=> query_embedding) as vector_rank,
      null::bigint as text_match_rank
    from public.document_memory_cards m
    join public.documents d on d.id = m.document_id
    cross join query
    where (document_filters is null or m.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(m.metadata, d.metadata)
      and (1 - (m.embedding <=> query_embedding)) >= min_similarity
    order by m.embedding <=> query_embedding
    limit greatest(match_count * 6, 96)
  ),
  text_ranked as (
    select
      m.*,
      (1 - (m.embedding <=> query_embedding))::double precision as similarity,
      ts_rank_cd(m.search_tsv, query.tsq)::double precision as text_rank,
      null::bigint as vector_rank,
      row_number() over (
        order by ts_rank_cd(m.search_tsv, query.tsq) desc, m.embedding <=> query_embedding
      ) as text_match_rank
    from public.document_memory_cards m
    join public.documents d on d.id = m.document_id
    cross join query
    where (document_filters is null or m.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(m.metadata, d.metadata)
      and m.search_tsv @@ query.tsq
    order by ts_rank_cd(m.search_tsv, query.tsq) desc
    limit greatest(match_count * 6, 96)
  ),
  combined as (
    select * from vector_ranked
    union all
    select * from text_ranked
  ),
  scored as (
    select
      id, document_id, owner_id, section_id, card_type, title, content, normalized_terms,
      page_number, source_chunk_ids, source_image_ids, confidence, metadata,
      max(similarity)::double precision as similarity,
      max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank,
      min(text_match_rank) as text_match_rank
    from combined
    group by
      id, document_id, owner_id, section_id, card_type, title, content, normalized_terms,
      page_number, source_chunk_ids, source_image_ids, confidence, metadata
  )
  select
    id, document_id, owner_id, section_id, card_type, title, content, normalized_terms,
    page_number, source_chunk_ids, source_image_ids, confidence, metadata, similarity, text_rank,
    (
      (similarity * 0.62)
      + (least(text_rank, 1) * 0.24)
      + (confidence * 0.10)
      + (
        coalesce(1.0 / (60 + vector_rank), 0)
        + coalesce(1.0 / (60 + text_match_rank), 0)
      ) * 0.04
    )::double precision as hybrid_score,
    (
      coalesce(1.0 / (60 + vector_rank), 0)
      + coalesce(1.0 / (60 + text_match_rank), 0)
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
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      lower(coalesce(query_text, '')) as normalized
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
    left join public.document_labels l
      on l.document_id = d.id
      and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
      and coalesce(l.metadata->>'hidden', 'false') <> 'true'
    left join public.document_summaries s on s.document_id = d.id
    cross join query
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
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
  lexical_score double precision,
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
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.metadata)
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit least(greatest(match_count * 2, 24), 96)
  ),
  -- Batch-fetch label metadata for all distinct document_ids in the result set.
  -- One query replaces N per-row calls to document_label_metadata().
  doc_labels as (
    select
      l.document_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',          l.id,
            'document_id', l.document_id,
            'owner_id',    l.owner_id,
            'label',       l.label,
            'label_type',  l.label_type,
            'source',      l.source,
            'confidence',  l.confidence,
            'metadata',    l.metadata,
            'created_at',  l.created_at,
            'updated_at',  l.updated_at
          )
          order by l.confidence desc, l.label
        ),
        '[]'::jsonb
      ) as labels
    from public.document_labels l
    where l.document_id in (select distinct ranked.document_id from ranked)
      and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
      and coalesce(l.metadata->>'hidden', 'false') <> 'true'
    group by l.document_id
  ),
  -- Batch-fetch summary text for all distinct document_ids in the result set.
  -- One query replaces N per-row calls to document_summary_text().
  doc_summaries as (
    select distinct on (s.document_id)
      s.document_id,
      s.summary
    from public.document_summaries s
    where s.document_id in (select distinct ranked.document_id from ranked)
    order by s.document_id
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
    coalesce(doc_labels.labels,   '[]'::jsonb) as document_labels,
    doc_summaries.summary                       as document_summary,
    -- Text-only fallback has NO vector cosine similarity. Do not fabricate one:
    -- a synthetic value here was read downstream as a real semantic score and
    -- could label a pure keyword hit as "strong"/"moderate" evidence (>=0.64).
    -- Leave similarity at 0; the lexical signal lives in lexical_score.
    0::double precision                                                              as similarity,
    ranked.text_rank,
    -- Cap hybrid_score well below the 0.64 "moderate" threshold so a lexical-only
    -- row can order amongst its peers but can never masquerade as a moderate/strong
    -- cosine match when merged with vector results.
    least(0.5,  0.18 + (least(ranked.text_rank, 1) * 0.3))::double precision       as hybrid_score,
    least(0.99, 0.4  + (least(ranked.text_rank, 1) * 0.59))::double precision      as lexical_score,
    public.chunk_image_metadata(ranked.image_ids)                                   as images
  from ranked
  left join doc_labels    on doc_labels.document_id    = ranked.document_id
  left join doc_summaries on doc_summaries.document_id = ranked.document_id
  order by lexical_score desc, text_rank desc
  limit match_count;
$$;

create or replace function public.match_document_lookup_chunks_text(
  query_text text,
  document_filters uuid[],
  match_count integer default 24,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  page_number integer,
  chunk_index integer,
  section_heading text,
  section_path text[],
  heading_level integer,
  parent_heading text,
  anchor_id text,
  content text,
  retrieval_synopsis text,
  image_ids uuid[],
  text_rank double precision
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  )
  select
    c.id,
    c.document_id,
    c.page_number,
    c.chunk_index,
    c.section_heading,
    c.section_path,
    c.heading_level,
    c.parent_heading,
    c.anchor_id,
    c.content,
    c.retrieval_synopsis,
    c.image_ids,
    (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (case when c.section_heading is not null then ts_rank_cd(to_tsvector('english', c.section_heading), query.tsq) * 0.35 else 0 end) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 0.25)
    )::double precision as text_rank
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  cross join query
  where document_filters is not null
    and c.document_id = any(document_filters)
    and public.retrieval_owner_matches(owner_filter, d.owner_id)
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.metadata)
    and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
  order by text_rank desc, c.chunk_index asc
  limit least(greatest(match_count, 1), 80);
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
          and public.retrieval_owner_matches(owner_filter, l.owner_id)
          and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
          and coalesce(l.metadata->>'hidden', 'false') <> 'true'
      ),
      '[]'::jsonb
    ) as labels,
    (
      select s.summary
      from public.document_summaries s
      where s.document_id = d.id
        and public.retrieval_owner_matches(owner_filter, s.owner_id)
      order by s.generated_at desc
      limit 1
    ) as summary
  from public.documents d
  where d.id = any(document_ids)
    and public.retrieval_owner_matches(owner_filter, d.owner_id);
$$;

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
  match_reason text,
  metadata jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      lower(coalesce(query_text, '')) as normalized,
      regexp_split_to_array(lower(coalesce(query_text, '')), '[^a-z0-9]+') as terms
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
        (
          similarity(
            lower(
              coalesce(f.table_title, '') || ' ' ||
              coalesce(f.row_label, '') || ' ' ||
              coalesce(f.clinical_parameter, '') || ' ' ||
              coalesce(f.threshold_value, '') || ' ' ||
              coalesce(f.action, '')
            ),
            query.normalized
          ) * 0.8
        ) +
        case
          when coalesce(f.threshold_value, '') <> ''
            and regexp_split_to_array(lower(f.threshold_value), '[^a-z0-9]+') && query.terms then 0.12
          else 0
        end +
        case
          when coalesce(f.action, '') <> ''
            and regexp_split_to_array(lower(f.action), '[^a-z0-9]+') && query.terms then 0.1
          else 0
        end
      )::double precision as text_rank,
      case
        when coalesce(f.threshold_value, '') <> '' then 'table_threshold'
        when coalesce(f.action, '') <> '' then 'table_action'
        else 'table_row'
      end as match_reason,
      f.metadata
    from public.document_table_facts f
    join public.documents d on d.id = f.document_id
    cross join query
    where (document_filters is null or f.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, f.owner_id)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(f.metadata, d.metadata)
      and (
        f.search_tsv @@ query.tsq
        or f.normalized_terms && query.terms
        or similarity(
          lower(
            coalesce(f.table_title, '') || ' ' ||
            coalesce(f.row_label, '') || ' ' ||
            coalesce(f.clinical_parameter, '') || ' ' ||
            coalesce(f.threshold_value, '') || ' ' ||
            coalesce(f.action, '')
          ),
          query.normalized
        ) >= 0.18
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
  min_similarity double precision default 0.5,
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
  vector_hits as (
    select f.id
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    where (document_filters is null or f.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(f.metadata, d.metadata)
      and f.source_chunk_id is not null
      and 1 - (f.embedding <=> query_embedding) >= min_similarity
    order by f.embedding <=> query_embedding
    limit greatest(match_count * 3, 32)
  ),
  text_hits as (
    select f.id
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    cross join query
    where (document_filters is null or f.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(f.metadata, d.metadata)
      and f.source_chunk_id is not null
      and f.search_tsv @@ query.tsq
    order by ts_rank_cd(f.search_tsv, query.tsq) desc
    limit greatest(match_count * 3, 32)
  ),
  candidate_ids as (
    select id from vector_hits
    union
    select id from text_hits
  ),
  ranked as (
    select
      f.id, f.document_id, f.source_chunk_id, f.field_type, f.content,
      (1 - (f.embedding <=> query_embedding))::double precision as similarity,
      ts_rank_cd(f.search_tsv, query.tsq)::double precision as text_rank
    from public.document_embedding_fields f
    join candidate_ids ci on ci.id = f.id
    cross join query
  )
  select
    id, document_id, source_chunk_id, field_type, content, similarity, text_rank,
    ((similarity * 0.7) + (least(text_rank, 1) * 0.3))::double precision as hybrid_score
  from ranked
  order by hybrid_score desc, similarity desc, text_rank desc
  limit match_count;
$$;

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
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      regexp_split_to_array(lower(coalesce(query_text, '')), '\s+') as terms
  ),
  ranked as (
    select u.id, u.document_id, u.source_chunk_id, u.source_image_id, u.unit_type, u.title, u.content, u.page_start,
      u.page_end, u.heading_path, u.normalized_terms, u.source_span, u.quality_score, u.extraction_mode,
      (1 - (u.embedding <=> query_embedding))::double precision as similarity,
      (ts_rank_cd(u.search_tsv, query.tsq)
        + case when u.normalized_terms && query.terms then 0.25 else 0 end
        + case when u.unit_type in ('askable_question', 'table_fact', 'clinical_fact', 'threshold', 'workflow_step', 'medication_monitoring', 'alias', 'visual_summary', 'flowchart_step', 'diagram_decision', 'risk_matrix_cell', 'medication_chart_row', 'chart_finding', 'visual_askable_question', 'table_threshold') then 0.06
               when u.unit_type = 'section_summary' then 0.03
               else 0 end
      )::double precision as text_rank,
      u.metadata
    from public.document_index_units u
    join public.documents d on d.id = u.document_id
    cross join query
    where d.status = 'indexed'
      and (document_filters is null or u.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and public.is_committed_artifact_generation(u.metadata, d.metadata)
      and u.source_chunk_id is not null
      and (u.search_tsv @@ query.tsq or u.normalized_terms && query.terms)
    order by text_rank desc
    limit greatest(match_count * 3, 48)
  )
  select id, document_id, source_chunk_id, source_image_id, unit_type, title, content, page_start, page_end, heading_path,
    normalized_terms, source_span, quality_score, extraction_mode, similarity, text_rank,
    (
      (similarity * 0.52)
      + (least(text_rank, 1) * 0.28)
      + (quality_score * 0.12)
      + (case when extraction_mode in ('model_heavy', 'hybrid') then 0.04 else 0 end)
      + (case when unit_type in ('askable_question', 'threshold', 'table_fact', 'table_threshold', 'visual_askable_question') then 0.04
              when unit_type in ('workflow_step', 'medication_monitoring', 'flowchart_step', 'diagram_decision', 'medication_chart_row', 'risk_matrix_cell') then 0.03
              else 0 end)
    )::double precision as hybrid_score,
    metadata
  from ranked
  order by hybrid_score desc, similarity desc, text_rank desc
  limit match_count;
$$;

-- Codify the live hybrid retrieval RPCs into migration history.
--
-- WHY: the performance/correctness fixes to the four app-path hybrid retrieval
-- RPCs (content-only candidate filters, HNSW/GIN UNION candidate sets, wider
-- candidate limits, the memory-cards ef_search wrapper) were applied to the live
-- `Clinical KB Database` via raw SQL and were NEVER captured in a migration. The
-- committed chain (`20260626020000_phase7_retrieval_rpc_performance` +
-- `20260628000000_atomic_reindex_generation_commit`) reproduces the OLD, slower
-- cross-table-OR candidate filters, so a `supabase db reset` / branch DB / fresh
-- environment silently rebuilds the pre-fix (seqscan-prone) retrieval layer and
-- loses the live behaviour.
--
-- These definitions are transcribed verbatim from the live functions (validated
-- by md5(pg_get_functiondef) equivalence before applying), so applying this
-- migration to the live project is a no-op, while a clean replay now reproduces
-- exactly what production runs. This CREATE OR REPLACE set supersedes the phase7
-- and atomic-reindex definitions for these functions.
--
-- `index_units` HNSW index note: its embedding path is text-candidate-gated and
-- the HNSW index is unused; codifying the function does not change that. The
-- dead index is dropped separately in 20260702014803 (applied 2026-07-02).

set search_path = public, extensions, pg_temp;

-- 1. document chunks -----------------------------------------------------------
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
      coalesce(q.quality_score, 0.7)::double precision as quality_score
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    left join public.document_index_quality q on q.document_id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
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
      coalesce(q.quality_score, 0.7)::double precision as quality_score
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    left join public.document_index_quality q on q.document_id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
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

-- 2. embedding fields (HNSW vector_hits UNION GIN text_hits) --------------------
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
      and (owner_filter is null or d.owner_id = owner_filter)
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
      and (owner_filter is null or d.owner_id = owner_filter)
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

-- 3. index units ---------------------------------------------------------------
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
        + case when u.unit_type in (
            'askable_question',
            'table_fact',
            'clinical_fact',
            'threshold',
            'workflow_step',
            'medication_monitoring',
            'alias',
            'visual_summary',
            'flowchart_step',
            'diagram_decision',
            'risk_matrix_cell',
            'medication_chart_row',
            'chart_finding',
            'visual_askable_question',
            'table_threshold'
          ) then 0.06
          when u.unit_type = 'section_summary' then 0.03
          else 0 end
      )::double precision as text_rank,
      u.metadata
    from public.document_index_units u
    join public.documents d on d.id = u.document_id
    cross join query
    where d.status = 'indexed'
      and (document_filters is null or u.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
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

-- 4. memory cards core (SQL) ---------------------------------------------------
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
      and (owner_filter is null or d.owner_id = owner_filter)
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
      and (owner_filter is null or d.owner_id = owner_filter)
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

-- 5. memory cards wrapper (plpgsql, sets HNSW ef_search then delegates) ---------
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
language plpgsql
stable
set search_path = public, extensions, pg_temp
as $$
BEGIN
  PERFORM set_config('hnsw.ef_search', '100', true);
  RETURN QUERY
select *
  from public.match_document_memory_cards_hybrid_v2(
    query_embedding,
    query_text,
    match_count,
    min_similarity,
    document_filters,
    owner_filter
  );
END
$$;

-- Service-role-only execution (matches live grants; needed on a fresh replay).
revoke execute on function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
revoke execute on function public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
revoke execute on function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
revoke execute on function public.match_document_memory_cards_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_memory_cards_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
revoke execute on function public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;

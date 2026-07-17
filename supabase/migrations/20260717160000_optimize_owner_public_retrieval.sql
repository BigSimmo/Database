-- Remove duplicate owner/public execution from the two retrieval RPCs observed
-- as production latency hotspots on 2026-07-17. The scoped helpers evaluate
-- the complete access predicate inside one query, preserving fail-closed owner
-- semantics while allowing public rows when explicitly requested.

create or replace function public.match_document_chunks_text_scoped(
  query_text text,
  match_count integer,
  document_filters uuid[],
  owner_filter uuid,
  include_public boolean
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
  -- Keep the chunk/title probes separate so each GIN index remains usable.
  -- Apply access and committed-generation gates before candidate union/ranking.
  chunk_hits as (
    select c.id
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where c.search_tsv @@ query.tsq
      and (document_filters is null or c.document_id = any(document_filters))
      and public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
  ),
  title_chunk_hits as (
    select c.id
    from public.documents d
    cross join query
    join public.document_chunks c on c.document_id = d.id
    where d.title_search_tsv @@ query.tsq
      and (document_filters is null or c.document_id = any(document_filters))
      and public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
  ),
  lexical_candidates as (
    select chunk_hits.id from chunk_hits
    union
    select title_chunk_hits.id from title_chunk_hits
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
    from lexical_candidates cand
    join public.document_chunks c on c.id = cand.id
    join public.documents d on d.id = c.document_id
    cross join query
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit least(greatest(match_count * 2, 24), 96)
  ),
  doc_labels as (
    select
      l.document_id,
      coalesce(
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
      ) as labels
    from public.document_labels l
    where l.document_id in (select distinct ranked.document_id from ranked)
      and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
      and coalesce(l.metadata->>'hidden', 'false') <> 'true'
    group by l.document_id
  ),
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
    coalesce(doc_labels.labels, '[]'::jsonb) as document_labels,
    doc_summaries.summary as document_summary,
    0::double precision as similarity,
    ranked.text_rank,
    least(0.5, 0.18 + (least(ranked.text_rank, 1) * 0.3))::double precision as hybrid_score,
    least(0.99, 0.4 + (least(ranked.text_rank, 1) * 0.59))::double precision as lexical_score,
    public.chunk_image_metadata(ranked.image_ids) as images
  from ranked
  left join doc_labels on doc_labels.document_id = ranked.document_id
  left join doc_summaries on doc_summaries.document_id = ranked.document_id
  order by hybrid_score desc, text_rank desc, ranked.id
  limit match_count;
$$;

create or replace function public.match_document_index_units_hybrid_scoped(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer,
  min_similarity double precision,
  document_filters uuid[],
  owner_filter uuid,
  include_public boolean
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
set plan_cache_mode = 'force_custom_plan'
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      regexp_split_to_array(lower(coalesce(query_text, '')), '\s+') as terms
  ),
  -- Split the OR into separately indexable GIN probes. Both branches enforce
  -- the full access/generation scope before their ids can enter the union.
  text_hits as (
    select u.id
    from public.document_index_units u
    join public.documents d on d.id = u.document_id
    cross join query
    where u.search_tsv @@ query.tsq
      and d.status = 'indexed'
      and (document_filters is null or u.document_id = any(document_filters))
      and public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)
      and public.is_committed_artifact_generation(u.metadata, d.metadata)
      and u.source_chunk_id is not null
  ),
  term_hits as (
    select u.id
    from public.document_index_units u
    join public.documents d on d.id = u.document_id
    cross join query
    where u.normalized_terms && query.terms
      and d.status = 'indexed'
      and (document_filters is null or u.document_id = any(document_filters))
      and public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)
      and public.is_committed_artifact_generation(u.metadata, d.metadata)
      and u.source_chunk_id is not null
  ),
  candidate_ids as (
    select text_hits.id from text_hits
    union
    select term_hits.id from term_hits
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
        ts_rank_cd(u.search_tsv, query.tsq)
        + case when u.normalized_terms && query.terms then 0.25 else 0 end
        + case
            when u.unit_type in (
              'askable_question', 'table_fact', 'clinical_fact', 'threshold',
              'workflow_step', 'medication_monitoring', 'alias', 'visual_summary',
              'flowchart_step', 'diagram_decision', 'risk_matrix_cell',
              'medication_chart_row', 'chart_finding', 'visual_askable_question',
              'table_threshold'
            ) then 0.06
            when u.unit_type = 'section_summary' then 0.03
            else 0
          end
      )::double precision as text_rank,
      u.metadata
    from candidate_ids candidates
    join public.document_index_units u on u.id = candidates.id
    cross join query
    order by text_rank desc
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
    (
      (similarity * 0.52)
      + (least(text_rank, 1) * 0.28)
      + (quality_score * 0.12)
      + (case when extraction_mode in ('model_heavy', 'hybrid') then 0.04 else 0 end)
      + (case
          when unit_type in ('askable_question', 'threshold', 'table_fact', 'table_threshold', 'visual_askable_question') then 0.04
          when unit_type in ('workflow_step', 'medication_monitoring', 'flowchart_step', 'diagram_decision', 'medication_chart_row', 'risk_matrix_cell') then 0.03
          else 0
        end)
    )::double precision as hybrid_score,
    metadata
  from ranked
  order by hybrid_score desc, id
  limit match_count;
$$;

-- The versioned RPCs now delegate once to the scoped helpers. This replaces
-- the previous owner query UNION ALL public query pattern.
create or replace function public.match_document_chunks_text_v2(
  query_text text,
  match_count integer default 12,
  document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
)
returns table (
  id uuid, document_id uuid, title text, file_name text, page_number integer,
  chunk_index integer, section_heading text, content text, retrieval_synopsis text,
  image_ids uuid[], source_metadata jsonb, document_labels jsonb, document_summary text,
  similarity double precision, text_rank double precision, hybrid_score double precision,
  lexical_score double precision, images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select *
  from public.match_document_chunks_text_scoped($1, $2, $3, $4, $5);
$$;

create or replace function public.match_document_index_units_hybrid_v2(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 24,
  min_similarity double precision default 0.1,
  document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
)
returns table (
  id uuid, document_id uuid, source_chunk_id uuid, source_image_id uuid, unit_type text, title text,
  content text, page_start integer, page_end integer, heading_path text[], normalized_terms text[],
  source_span jsonb, quality_score real, extraction_mode text, similarity double precision,
  text_rank double precision, hybrid_score double precision, metadata jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select *
  from public.match_document_index_units_hybrid_scoped($1, $2, $3, $4, $5, $6, $7);
$$;

revoke all on function public.match_document_chunks_text_scoped(text, integer, uuid[], uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.match_document_chunks_text_scoped(text, integer, uuid[], uuid, boolean)
  to service_role;
revoke all on function public.match_document_index_units_hybrid_scoped(
  extensions.vector, text, integer, double precision, uuid[], uuid, boolean
) from public, anon, authenticated;
grant execute on function public.match_document_index_units_hybrid_scoped(
  extensions.vector, text, integer, double precision, uuid[], uuid, boolean
) to service_role;

revoke all on function public.match_document_chunks_text_v2(text, integer, uuid[], uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.match_document_chunks_text_v2(text, integer, uuid[], uuid, boolean)
  to service_role;
revoke all on function public.match_document_index_units_hybrid_v2(
  extensions.vector, text, integer, double precision, uuid[], uuid, boolean
) from public, anon, authenticated;
grant execute on function public.match_document_index_units_hybrid_v2(
  extensions.vector, text, integer, double precision, uuid[], uuid, boolean
) to service_role;

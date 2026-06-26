alter table public.document_index_units
  drop constraint if exists document_index_units_unit_type_check;

alter table public.document_index_units
  add constraint document_index_units_unit_type_check
  check (
    unit_type in (
      'document_profile',
      'section_summary',
      'page_text',
      'chunk_evidence',
      'table_fact',
      'askable_question',
      'clinical_fact',
      'threshold',
      'workflow_step',
      'medication_monitoring',
      'alias',
      'vocabulary_term'
    )
  );

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
        + case when u.unit_type in ('askable_question', 'table_fact', 'clinical_fact', 'threshold', 'workflow_step', 'medication_monitoring', 'alias') then 0.06
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
      and u.source_chunk_id is not null
      and (u.search_tsv @@ query.tsq or u.normalized_terms && query.terms)
    order by text_rank desc, similarity desc
    limit greatest(match_count * 3, 48)
  )
  select id, document_id, source_chunk_id, source_image_id, unit_type, title, content, page_start, page_end, heading_path,
    normalized_terms, source_span, quality_score, extraction_mode, similarity, text_rank,
    (
      (similarity * 0.52)
      + (least(text_rank, 1) * 0.28)
      + (quality_score * 0.12)
      + (case when extraction_mode in ('model_heavy', 'hybrid') then 0.04 else 0 end)
      + (case when unit_type in ('askable_question', 'threshold', 'table_fact') then 0.04
              when unit_type in ('workflow_step', 'medication_monitoring') then 0.03
              else 0 end)
    )::double precision as hybrid_score,
    metadata
  from ranked
  order by hybrid_score desc, similarity desc, text_rank desc
  limit match_count;
$$;

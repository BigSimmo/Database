-- RET-C2: match_document_chunks_text fabricated a fake cosine `similarity` from
-- text_rank (least(0.95, 0.56 + text_rank*0.39)). Downstream code reads that
-- field as a real semantic score, so a pure keyword hit was labeled "strong"
-- evidence and the 0.56 floor suppressed the low-confidence banner exactly when
-- retrieval had degraded to text fallback.
--
-- This migration returns the lexical signal in a distinct `lexical_score` column,
-- leaves `similarity` at 0 for text-only rows (no vector cosine exists), and caps
-- `hybrid_score` well below the 0.64 "moderate" threshold so a lexical-only row
-- can order amongst its peers but never masquerades as a moderate/strong match.
--
-- Adding a return column requires dropping the function first (CREATE OR REPLACE
-- cannot change the OUT signature).

drop function if exists public.match_document_chunks_text(text, integer, uuid[], uuid);

create function public.match_document_chunks_text(
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
    0::double precision as similarity,
    ranked.text_rank,
    least(0.5, 0.18 + (least(ranked.text_rank, 1) * 0.3))::double precision as hybrid_score,
    least(0.99, 0.4 + (least(ranked.text_rank, 1) * 0.59))::double precision as lexical_score,
    public.chunk_image_metadata(ranked.image_ids) as images
  from ranked
  order by lexical_score desc, text_rank desc
  limit match_count;
$$;

grant execute on function public.match_document_chunks_text(text, integer, uuid[], uuid) to service_role;

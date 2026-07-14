-- Promote the document-level committed index generation pointer from JSONB
-- metadata to a typed column (2026-07-13 audit, deferred item D2; finding 1
-- stretch, staged after the A1 lexical RPC rewrite proved out).
--
-- documents.metadata->>'index_generation_id' stays the source of truth: every
-- writer (commit_document_index_generation via apply_document_metadata_patch,
-- the legacy batch repair, reconcile paths) keeps writing JSON only. The typed
-- column is GENERATED ALWAYS ... STORED, so it can never drift from the JSON
-- value - no dual-write, no trigger, no writer changes, and the ADD COLUMN
-- table rewrite backfills every existing row in the same statement.
--
-- A malformed (non-UUID) metadata value generates NULL rather than failing the
-- rewrite or later row updates. That matches the old reader semantics: the old
-- text comparison could never equal a malformed value either, so committed
-- (non-null-generation) rows stay invisible for such a document and
-- null-generation legacy rows stay visible.
--
-- Readers: is_committed_document_generation gains a (uuid, uuid) overload
-- (same truth table as the (uuid, jsonb) original, which stays for any
-- other caller), and the five effective reader functions that previously
-- fished the document's generation out of JSONB per candidate row now compare
-- typed columns:
--   corpus_topic_term_stats, match_document_chunks (codified live body),
--   match_document_chunks_hybrid (codified live body),
--   match_document_chunks_text, match_document_lookup_chunks_text.
-- The _v2 wrappers delegate to these and inherit the change. Function bodies
-- below are byte-exact copies of the current effective definitions with only
-- that one argument changed. One deliberate nuance: uuid equality is
-- normalized where the old text comparison was byte-sensitive; Postgres and
-- the worker always emit lowercase UUIDs, so behavior is unchanged in
-- practice and strictly more correct at the margin.

alter table public.documents
  add column if not exists index_generation_id uuid generated always as (
    case
      when metadata->>'index_generation_id'
        ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then (metadata->>'index_generation_id')::uuid
      else null
    end
  ) stored;

-- Typed overload: NULL row generation keeps legacy rows visible; otherwise
-- compare typed to typed (NULL document generation yields NULL -> filtered,
-- exactly like the old text comparison against a missing metadata key).
create or replace function public.is_committed_document_generation(
  row_generation uuid,
  document_generation uuid
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select row_generation is null
    or row_generation = document_generation;
$$;

revoke execute on function public.is_committed_document_generation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_committed_document_generation(uuid, uuid) to service_role;


create or replace function public.corpus_topic_term_stats(
  terms text[],
  owner_filter uuid default null
)
returns table (
  term text,
  has_ts_signal boolean,
  title_doc_count integer,
  chunk_present boolean,
  total_doc_count integer
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with input_terms as (
    select distinct lower(btrim(t.term)) as term
    from unnest(coalesce(terms, array[]::text[])) with ordinality as t(term, ord)
    where btrim(t.term) <> ''
      and t.ord <= 8
  ),
  totals as (
    select count(*)::integer as total_doc_count
    from public.documents d
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
  )
  select
    it.term,
    plainto_tsquery('english', it.term) <> ''::tsquery as has_ts_signal,
    (
      select count(*)::integer
      from public.documents d
      where public.retrieval_owner_matches(owner_filter, d.owner_id)
        and d.status = 'indexed'
        and d.title_search_tsv @@ plainto_tsquery('english', it.term)
    ) as title_doc_count,
    exists (
      select 1
      from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where public.retrieval_owner_matches(owner_filter, d.owner_id)
        and d.status = 'indexed'
        and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
        and c.search_tsv @@ plainto_tsquery('english', it.term)
    ) as chunk_present,
    totals.total_doc_count
  from input_terms it
  cross join totals;
$$;

revoke all on function public.corpus_topic_term_stats(text[], uuid) from public;
revoke all on function public.corpus_topic_term_stats(text[], uuid) from anon;
revoke all on function public.corpus_topic_term_stats(text[], uuid) from authenticated;
grant execute on function public.corpus_topic_term_stats(text[], uuid) to service_role;

CREATE OR REPLACE FUNCTION public.match_document_chunks(query_embedding vector, match_count integer DEFAULT 8, min_similarity double precision DEFAULT 0.15, document_filter uuid DEFAULT NULL::uuid, owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, title text, file_name text, page_number integer, chunk_index integer, section_heading text, content text, retrieval_synopsis text, image_ids uuid[], source_metadata jsonb, document_labels jsonb, document_summary text, similarity double precision, images jsonb)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  PERFORM set_config('hnsw.ef_search', '100', true);
  RETURN QUERY
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
    and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
END
$function$;

CREATE OR REPLACE FUNCTION public.match_document_chunks_hybrid(query_embedding vector, query_text text, match_count integer DEFAULT 12, min_similarity double precision DEFAULT 0.12, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, title text, file_name text, page_number integer, chunk_index integer, section_heading text, content text, retrieval_synopsis text, image_ids uuid[], source_metadata jsonb, similarity double precision, text_rank double precision, hybrid_score double precision, rrf_score double precision, images jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  with query as (select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq),
  vector_ranked as (
    select c.id, c.document_id, c.page_number, c.chunk_index, c.section_heading, c.content, c.retrieval_synopsis, c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0))::double precision as text_rank,
      row_number() over (order by c.embedding <=> query_embedding) as vector_rank, null::bigint as text_match_rank,
      coalesce((d.metadata->'rag_indexing_version') is not null, false) as has_deep_index, d.updated_at as doc_updated_at,
      coalesce(q.quality_score, 0.7)::double precision as quality_score
    from public.document_chunks c join public.documents d on d.id = c.document_id
    left join public.document_index_quality q on q.document_id = c.document_id cross join query
    where (document_filters is null or c.document_id = any(document_filters)) and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed' and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
      and 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding limit greatest(match_count * 6, 48)
  ),
  text_ranked as (
    select c.id, c.document_id, c.page_number, c.chunk_index, c.section_heading, c.content, c.retrieval_synopsis, c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0))::double precision as text_rank,
      null::bigint as vector_rank,
      row_number() over (order by (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)) desc, c.embedding <=> query_embedding) as text_match_rank,
      coalesce((d.metadata->'rag_indexing_version') is not null, false) as has_deep_index, d.updated_at as doc_updated_at,
      coalesce(q.quality_score, 0.7)::double precision as quality_score
    from public.document_chunks c join public.documents d on d.id = c.document_id
    left join public.document_index_quality q on q.document_id = c.document_id cross join query
    where (document_filters is null or c.document_id = any(document_filters)) and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed' and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
      and c.search_tsv @@ query.tsq
    order by (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)) desc limit greatest(match_count * 6, 48)
  ),
  combined as (select * from vector_ranked union all select * from text_ranked),
  scored as (
    select id, document_id, page_number, chunk_index, section_heading, content, retrieval_synopsis, image_ids,
      max(similarity)::double precision as similarity, max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank, min(text_match_rank) as text_match_rank,
      max(quality_score)::double precision as quality_score, bool_or(has_deep_index) as has_deep_index, max(doc_updated_at) as doc_updated_at
    from combined group by id, document_id, page_number, chunk_index, section_heading, content, retrieval_synopsis, image_ids
  ),
  scored_metrics as (
    select scored.*,
      ((scored.similarity * 0.62) + (least(scored.text_rank, 1) * 0.22) + (scored.quality_score * 0.10) + (case when scored.doc_updated_at > now() - interval '90 days' then 0.06 else 0 end))::double precision as hybrid_score,
      (coalesce(1.0 / (60 + scored.vector_rank), 0) + coalesce(1.0 / (60 + scored.text_match_rank), 0))::double precision as rrf_score
    from scored
  ),
  hybrid_candidates as (select id from scored_metrics order by hybrid_score desc, similarity desc, text_rank desc limit match_count),
  vector_candidates as (select id from scored_metrics order by similarity desc, hybrid_score desc limit match_count),
  text_candidates as (select id from scored_metrics order by text_rank desc, hybrid_score desc limit match_count),
  rrf_candidates as (select id from scored_metrics order by rrf_score desc, hybrid_score desc limit match_count),
  candidate_ids as (select id from hybrid_candidates union select id from vector_candidates union select id from text_candidates union select id from rrf_candidates)
  select c.id, c.document_id, d.title, d.file_name, c.page_number, c.chunk_index, c.section_heading, c.content, c.retrieval_synopsis, c.image_ids,
    d.metadata as source_metadata, c.similarity, c.text_rank, c.hybrid_score, c.rrf_score, public.chunk_image_metadata(c.image_ids) as images
  from scored_metrics c join candidate_ids candidates on candidates.id = c.id join public.documents d on d.id = c.document_id
  order by c.hybrid_score desc, c.rrf_score desc, c.similarity desc, c.text_rank desc limit match_count;
$function$;

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
  -- The chunk/title disjunction is split into two separately indexable probes:
  -- OR-ing predicates across document_chunks and documents defeated both GIN
  -- indexes and sequential-scanned every chunk (2026-07-13 audit, finding 1).
  -- Chunk-content matches probe document_chunks_search_idx directly.
  chunk_hits as (
    select c.id
    from public.document_chunks c
    cross join query
    where c.search_tsv @@ query.tsq
      and (document_filters is null or c.document_id = any(document_filters))
  ),
  -- Title matches probe documents_title_search_idx, then fan out to that
  -- document's chunks through document_chunks_document_idx.
  title_chunk_hits as (
    select c.id
    from public.documents d
    cross join query
    join public.document_chunks c on c.document_id = d.id
    where d.title_search_tsv @@ query.tsq
      and (document_filters is null or c.document_id = any(document_filters))
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
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
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

revoke execute on function public.match_document_chunks_text(text, integer, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.match_document_chunks_text(text, integer, uuid[], uuid)
  to service_role;

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
    and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
    and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
  order by text_rank desc, c.chunk_index asc
  limit least(greatest(match_count, 1), 80);
$$;

revoke execute on function public.match_document_lookup_chunks_text(text, uuid[], integer, uuid) from public, anon, authenticated;
grant execute on function public.match_document_lookup_chunks_text(text, uuid[], integer, uuid) to service_role;

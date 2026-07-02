-- Companion to 20260701010000_fix_chunks_hybrid_perf_and_ambiguity.sql.
-- The other three hybrid retrieval RPCs had the SAME live-only drift: converted from `language sql`
-- to `language plpgsql` (to PERFORM set_config('hnsw.ef_search','100',true)), which made the final
-- `select id ... from <cte>` ambiguous (RETURNS TABLE output-param vs CTE column) so each RPC threw
-- 42702 and the app silently fell back off that hybrid layer. Fixing the ambiguity alone re-exposed
-- plpgsql generic-plan seq-scans over the 111k/215k/53k-row artifact tables. This migration reverts
-- all three to `language sql` and, where needed, restructures the candidate set so each layer uses
-- its indexes. Validated on live 2026-07-01 via eval:retrieval:quality (content_recall@5=1.0,
-- top_k_hit_rate=1.0; hybrid layers now execute in ~0.25-0.7s instead of fast-failing).
--
-- Per-function fix:
--  * index_units    — text-candidate-gated (search_tsv @@ q OR normalized_terms && terms, both GIN),
--                     vector distance computed only for the bounded (<=72) candidate set.
--  * embedding_fields — UNION of vector_hits (HNSW order-by-distance) + text_hits (GIN), then scores
--                     only the small combined id set; replaces the 215k-row vector/text OR seq-scan.
--  * memory_cards_v2 — already had the good shape (separate vector/text CTEs, no cross-table OR);
--                     only the plpgsql->sql conversion was required. ef_search=100 is still applied
--                     by the outer wrapper match_document_memory_cards_hybrid (plpgsql), which the app
--                     calls and which delegates here.
--
-- NOTE: these functions originated from live-only drift and were never in committed migrations, so
-- this file both fixes and reconciles them. The outer plpgsql wrappers (match_document_memory_cards_hybrid)
-- and the unused experimental match_document_memory_cards_hybrid_v3 are NOT recreated here; v3 remains
-- on the (dead, unused) plpgsql path and had its grants hardened live. Full wrapper-chain drift
-- reconciliation is tracked as a follow-up. See docs / plan.

set search_path = public, extensions;

-- 1) index_units --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_document_index_units_hybrid(query_embedding vector, query_text text, match_count integer DEFAULT 24, min_similarity double precision DEFAULT 0.1, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, source_chunk_id uuid, source_image_id uuid, unit_type text, title text, content text, page_start integer, page_end integer, heading_path text[], normalized_terms text[], source_span jsonb, quality_score real, extraction_mode text, similarity double precision, text_rank double precision, hybrid_score double precision, metadata jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

revoke execute on function public.match_document_index_units_hybrid(vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_index_units_hybrid(vector, text, integer, double precision, uuid[], uuid) to service_role;

-- 2) embedding_fields ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_document_embedding_fields_hybrid(query_embedding vector, query_text text, match_count integer DEFAULT 16, min_similarity double precision DEFAULT 0.5, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, source_chunk_id uuid, field_type text, content text, similarity double precision, text_rank double precision, hybrid_score double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

revoke execute on function public.match_document_embedding_fields_hybrid(vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_embedding_fields_hybrid(vector, text, integer, double precision, uuid[], uuid) to service_role;

-- 3) memory_cards (inner implementation) --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_document_memory_cards_hybrid_v2(query_embedding vector, query_text text, match_count integer DEFAULT 32, min_similarity double precision DEFAULT 0.1, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, owner_id uuid, section_id uuid, card_type text, title text, content text, normalized_terms text[], page_number integer, source_chunk_ids uuid[], source_image_ids uuid[], confidence real, metadata jsonb, similarity double precision, text_rank double precision, hybrid_score double precision, rrf_score double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

revoke execute on function public.match_document_memory_cards_hybrid_v2(vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_memory_cards_hybrid_v2(vector, text, integer, double precision, uuid[], uuid) to service_role;

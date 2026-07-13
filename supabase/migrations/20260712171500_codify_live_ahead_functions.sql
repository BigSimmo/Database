-- Codified live-ahead governance and retrieval functions (2026-07-13).
CREATE OR REPLACE FUNCTION public.get_related_document_metadata(document_ids uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(document_id uuid, labels jsonb, summary text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
    and public.retrieval_owner_matches(owner_filter, d.owner_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_visual_evidence_cards(p_document_id uuid, p_limit integer DEFAULT 40)
 RETURNS TABLE(unit_id uuid, unit_type text, unit_title text, unit_content text, source_image_id uuid, image_storage_path text, image_caption text, page_number integer, image_type text, unit_quality_score real, unit_metadata jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select
    u.id as unit_id,
    u.unit_type,
    u.title as unit_title,
    u.content as unit_content,
    u.source_image_id,
    i.storage_path as image_storage_path,
    i.caption as image_caption,
    coalesce(u.page_start, i.page_number) as page_number,
    i.image_type,
    u.quality_score as unit_quality_score,
    u.metadata as unit_metadata
  from public.document_index_units u
  left join public.document_images i on i.id = u.source_image_id
  where u.document_id = p_document_id
    and u.source_image_id is not null
    and u.unit_type in (
      'visual_summary',
      'flowchart_step',
      'diagram_decision',
      'risk_matrix_cell',
      'medication_chart_row',
      'table_threshold',
      'chart_finding',
      'visual_askable_question',
      'table_fact'
    )
  order by u.quality_score desc nulls last, page_number asc nulls last
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$function$;

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
    and public.is_committed_document_generation(c.index_generation_id, d.metadata)
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
      and d.status = 'indexed' and public.is_committed_document_generation(c.index_generation_id, d.metadata)
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
      and d.status = 'indexed' and public.is_committed_document_generation(c.index_generation_id, d.metadata)
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

-- PostgreSQL cannot replace a function when its OUT row type changes. Production
-- already had this captured signature; fresh migration replays need an explicit drop.
DROP FUNCTION IF EXISTS public.match_document_chunks_text(text, integer, uuid[], uuid);

CREATE OR REPLACE FUNCTION public.match_document_chunks_text(query_text text, match_count integer DEFAULT 12, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, title text, file_name text, page_number integer, chunk_index integer, section_heading text, content text, retrieval_synopsis text, image_ids uuid[], source_metadata jsonb, document_labels jsonb, document_summary text, similarity double precision, text_rank double precision, hybrid_score double precision, images jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  chunk_seed as (
    select
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.retrieval_synopsis,
      c.image_ids,
      c.search_tsv
    from query q
    join public.document_chunks c on c.search_tsv @@ q.tsq
    join public.documents d on d.id = c.document_id
    where (document_filters is null or c.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.metadata)
    limit greatest(match_count * 80, 1200)
  ),
  chunk_matches as (
    select
      s.id,
      s.document_id,
      d.title,
      d.file_name,
      s.page_number,
      s.chunk_index,
      s.section_heading,
      s.content,
      s.retrieval_synopsis,
      s.image_ids,
      d.metadata as source_metadata,
      (
        ts_rank_cd(s.search_tsv, q.tsq) +
        (ts_rank_cd(d.title_search_tsv, q.tsq) * 3.0)
      )::double precision as text_rank
    from chunk_seed s
    join public.documents d on d.id = s.document_id
    cross join query q
    order by text_rank desc
    limit greatest(match_count * 20, 240)
  ),
  title_docs as (
    select
      d.id,
      d.title,
      d.file_name,
      d.metadata,
      q.tsq,
      ts_rank_cd(d.title_search_tsv, q.tsq)::double precision as title_rank
    from query q
    join public.documents d on d.title_search_tsv @@ q.tsq
    where (document_filters is null or d.id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
    order by ts_rank_cd(d.title_search_tsv, q.tsq) desc
    limit greatest(match_count * 6, 48)
  ),
  title_matches as (
    select
      c.id,
      c.document_id,
      td.title,
      td.file_name,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.retrieval_synopsis,
      c.image_ids,
      td.metadata as source_metadata,
      (
        ts_rank_cd(c.search_tsv, td.tsq) +
        (td.title_rank * 3.0)
      )::double precision as text_rank
    from title_docs td
    join lateral (
      select
        c.id,
        c.document_id,
        c.page_number,
        c.chunk_index,
        c.section_heading,
        c.content,
        c.retrieval_synopsis,
        c.image_ids,
        c.search_tsv
      from public.document_chunks c
      where c.document_id = td.id
        and public.is_committed_document_generation(c.index_generation_id, td.metadata)
      order by ts_rank_cd(c.search_tsv, td.tsq) desc, c.chunk_index asc
      limit 8
    ) c on true
  ),
  combined as (
    select * from chunk_matches
    union all
    select * from title_matches
  ),
  deduped as (
    select distinct on (c.id)
      c.id,
      c.document_id,
      c.title,
      c.file_name,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.retrieval_synopsis,
      c.image_ids,
      c.source_metadata,
      c.text_rank
    from combined c
    order by c.id, c.text_rank desc
  ),
  ranked as (
    select *
    from deduped
    order by text_rank desc
    limit greatest(match_count * 5, 48)
  ),
  label_meta as (
    select
      l.document_id,
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
      ) as labels
    from public.document_labels l
    where l.document_id in (select distinct document_id from ranked)
    group by l.document_id
  ),
  summary_meta as (
    select s.document_id, max(s.summary) as summary
    from public.document_summaries s
    where s.document_id in (select distinct document_id from ranked)
    group by s.document_id
  )
  select
    r.id,
    r.document_id,
    r.title,
    r.file_name,
    r.page_number,
    r.chunk_index,
    r.section_heading,
    r.content,
    r.retrieval_synopsis,
    r.image_ids,
    r.source_metadata,
    coalesce(lm.labels, '[]'::jsonb) as document_labels,
    sm.summary as document_summary,
    least(0.95, 0.56 + (least(r.text_rank, 1) * 0.39))::double precision as similarity,
    r.text_rank,
    least(0.97, 0.58 + (least(r.text_rank, 1) * 0.39))::double precision as hybrid_score,
    public.chunk_image_metadata(r.image_ids) as images
  from ranked r
  left join label_meta lm on lm.document_id = r.document_id
  left join summary_meta sm on sm.document_id = r.document_id
  order by hybrid_score desc, r.text_rank desc
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_document_embedding_fields_text(query_text text, match_count integer DEFAULT 16, min_text_rank double precision DEFAULT 0.0, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, source_chunk_id uuid, field_type text, content text, text_rank double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  with q as (select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq),
  ranked as (
    select f.id, f.document_id, f.source_chunk_id, f.field_type, f.content,
      ts_rank_cd(f.search_tsv, q.tsq)::double precision as text_rank
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    cross join q
    where f.source_chunk_id is not null
      and (document_filters is null or f.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed' and f.search_tsv @@ q.tsq
  )
  select * from ranked where text_rank >= min_text_rank
  order by text_rank desc, id limit match_count;
$function$;

DROP FUNCTION IF EXISTS public.match_document_table_facts_text(text, integer, uuid[], uuid);

CREATE OR REPLACE FUNCTION public.match_document_table_facts_text(query_text text, match_count integer DEFAULT 16, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, source_chunk_id uuid, source_image_id uuid, page_number integer, table_title text, row_label text, clinical_parameter text, threshold_value text, action text, text_rank double precision, match_reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
  with query as (
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      lower(trim(regexp_replace(coalesce(query_text, ''), '\\s+', ' ', 'g'))) as normalized,
      string_to_array(lower(trim(regexp_replace(coalesce(query_text, ''), '\\s+', ' ', 'g'))), ' ')::text[] as tokens
  ),
  doc_scope as (
    select d.id, d.metadata
    from public.documents d
    where d.status = 'indexed'
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and (document_filters is null or d.id = any(document_filters))
  ),
  fts_matches as (
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
      ts_rank_cd(f.search_tsv, q.tsq)::double precision as text_rank,
      case
        when coalesce(f.threshold_value, '') <> '' then 'table_threshold'
        when coalesce(f.action, '') <> '' then 'table_action'
        else 'table_row'
      end as match_reason
    from query q
    join public.document_table_facts f on f.search_tsv @@ q.tsq
    join doc_scope ds on ds.id = f.document_id
    where public.is_committed_artifact_generation(f.metadata, ds.metadata)
    order by ts_rank_cd(f.search_tsv, q.tsq) desc
    limit greatest(match_count * 5, 64)
  ),
  term_matches as (
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
      0.45::double precision as text_rank,
      'term_overlap'::text as match_reason
    from query q
    join public.document_table_facts f
      on cardinality(q.tokens) > 0
     and f.normalized_terms && q.tokens
    join doc_scope ds on ds.id = f.document_id
    where public.is_committed_artifact_generation(f.metadata, ds.metadata)
    limit greatest(match_count * 4, 48)
  ),
  trgm_matches as (
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
      (similarity(lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')), q.normalized) * 0.8)::double precision as text_rank,
      'trgm_similarity'::text as match_reason
    from query q
    join public.document_table_facts f
      on lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')) % q.normalized
    join doc_scope ds on ds.id = f.document_id
    where public.is_committed_artifact_generation(f.metadata, ds.metadata)
      and similarity(lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')), q.normalized) >= 0.18
    order by similarity(lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')), q.normalized) desc
    limit greatest(match_count * 4, 48)
  ),
  combined as (
    select * from fts_matches
    union all
    select * from term_matches
    union all
    select * from trgm_matches
  ),
  deduped as (
    select distinct on (c.id)
      c.id,
      c.document_id,
      c.source_chunk_id,
      c.source_image_id,
      c.page_number,
      c.table_title,
      c.row_label,
      c.clinical_parameter,
      c.threshold_value,
      c.action,
      c.text_rank,
      c.match_reason
    from combined c
    order by c.id, c.text_rank desc
  )
  select
    d.id,
    d.document_id,
    d.source_chunk_id,
    d.source_image_id,
    d.page_number,
    d.table_title,
    d.row_label,
    d.clinical_parameter,
    d.threshold_value,
    d.action,
    d.text_rank,
    d.match_reason
  from deduped d
  where d.text_rank > 0
  order by d.text_rank desc, d.page_number asc nulls last
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_documents_for_query(query_text text, match_count integer DEFAULT 12, owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, owner_id uuid, title text, file_name text, status text, page_count integer, chunk_count integer, image_count integer, metadata jsonb, text_rank double precision, match_reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and (d.title_search_tsv @@ query.tsq or d.search_tsv @@ query.tsq)
  )
  select *
  from ranked
  where text_rank > 0
  order by text_rank desc, page_count desc, title asc
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION public.repair_enrichment_quality_batch(p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_result jsonb;
begin
  with candidate_docs as (
    select d.id as document_id, d.owner_id, d.title
    from public.documents d
    left join public.document_index_quality q on q.document_id = d.id
    where d.status = 'indexed'
      and (
        q.document_id is null
        or q.extraction_quality in ('partial','poor','unknown')
        or not exists (select 1 from public.document_embedding_fields e where e.document_id = d.id and e.field_type = 'document_title')
      )
    order by d.updated_at asc nulls first
    limit v_limit
  ),
  doc_avg_embedding as (
    select c.document_id,
           avg(ch.embedding) as avg_embedding,
           (array_agg(ch.id order by ch.chunk_index asc))[1] as sample_chunk_id
    from candidate_docs c
    join public.document_chunks ch on ch.document_id = c.document_id
    where ch.embedding is not null
    group by c.document_id
  ),
  ensured_summary as (
    insert into public.document_summaries (id, document_id, owner_id, summary, clinical_specifics, source_chunk_ids, source_image_ids, model, metadata)
    select gen_random_uuid(), c.document_id, c.owner_id,
           left(coalesce((select string_agg(left(ch.content, 300), E'\n\n' order by ch.chunk_index) from (select * from public.document_chunks ch where ch.document_id = c.document_id order by ch.chunk_index limit 3) ch), c.title, 'Document summary unavailable'), 3000),
           '{}'::jsonb,
           coalesce((select array_agg(ch.id order by ch.chunk_index) from (select * from public.document_chunks ch where ch.document_id = c.document_id order by ch.chunk_index limit 5) ch), '{}'::uuid[]),
           '{}'::uuid[],
           'deterministic-repair-v1',
           jsonb_build_object('repair_source','db_repair','anchored',true)
    from candidate_docs c
    where not exists (select 1 from public.document_summaries s where s.document_id = c.document_id)
    returning document_id
  ),
  ensured_sections as (
    insert into public.document_sections (id, document_id, owner_id, section_index, heading, heading_path, page_start, page_end, chunk_ids, summary, tags, extraction_quality, metadata)
    select gen_random_uuid(), c.document_id, c.owner_id, 1,
           coalesce(nullif(trim((select ch.section_heading from public.document_chunks ch where ch.document_id = c.document_id order by ch.chunk_index asc limit 1)), ''), 'Main Section'),
           coalesce((select ch.section_path from public.document_chunks ch where ch.document_id = c.document_id order by ch.chunk_index asc limit 1), array['Main Section']::text[]),
           coalesce((select min(ch.page_number) from public.document_chunks ch where ch.document_id = c.document_id), 1),
           coalesce((select max(ch.page_number) from public.document_chunks ch where ch.document_id = c.document_id), 1),
           coalesce((select array_agg(ch.id order by ch.chunk_index) from public.document_chunks ch where ch.document_id = c.document_id), '{}'::uuid[]),
           left(coalesce((select summary from public.document_summaries s where s.document_id = c.document_id limit 1), c.title, 'Section summary unavailable'), 3000),
           array['repair_generated']::text[], 'partial', jsonb_build_object('repair_source','db_repair','anchored',true)
    from candidate_docs c
    where not exists (select 1 from public.document_sections s where s.document_id = c.document_id)
    returning document_id
  ),
  ensured_memory_cards as (
    insert into public.document_memory_cards (id, document_id, owner_id, section_id, card_type, title, content, normalized_terms, page_number, source_chunk_ids, source_image_ids, confidence, metadata, embedding)
    select gen_random_uuid(), s.document_id, s.owner_id, s.id, 'section_summary',
           left(coalesce(nullif(trim(s.heading),''), 'Section Memory'), 200), left(s.summary, 4000),
           array_remove(regexp_split_to_array(lower(coalesce(s.heading,'')), '\\W+'), '')::text[],
           coalesce(s.page_start, 1), coalesce(s.chunk_ids, '{}'::uuid[]), '{}'::uuid[], 0.70,
           jsonb_build_object('repair_source','db_repair','anchored',true,'from','document_sections.summary'),
           coalesce((select ch.embedding from public.document_chunks ch where ch.id = any(s.chunk_ids) and ch.embedding is not null order by ch.chunk_index asc limit 1), dae.avg_embedding)
    from public.document_sections s
    join candidate_docs c on c.document_id = s.document_id
    left join doc_avg_embedding dae on dae.document_id = s.document_id
    where not exists (select 1 from public.document_memory_cards mc where mc.document_id = s.document_id)
      and length(trim(coalesce(s.summary,''))) > 0
      and coalesce((select ch.embedding from public.document_chunks ch where ch.id = any(s.chunk_ids) and ch.embedding is not null order by ch.chunk_index asc limit 1), dae.avg_embedding) is not null
    returning document_id
  ),
  ensured_title_embedding as (
    insert into public.document_embedding_fields (id, owner_id, document_id, source_chunk_id, field_type, content, embedding, metadata, content_hash)
    select gen_random_uuid(), c.owner_id, c.document_id, dae.sample_chunk_id, 'document_title',
           left(coalesce(nullif(trim(c.title),''), 'Untitled document'), 2000), dae.avg_embedding,
           jsonb_build_object('repair_source','db_repair','anchored',true,'derived_embedding','avg_chunk_embedding'),
           encode(digest(coalesce(c.title,'Untitled document'),'sha256'),'hex')
    from candidate_docs c
    join doc_avg_embedding dae on dae.document_id = c.document_id
    where not exists (select 1 from public.document_embedding_fields e where e.document_id = c.document_id and e.field_type = 'document_title')
    returning document_id
  ),
  ensured_summary_embedding as (
    insert into public.document_embedding_fields (id, owner_id, document_id, source_chunk_id, field_type, content, embedding, metadata, content_hash)
    select gen_random_uuid(), c.owner_id, c.document_id, dae.sample_chunk_id, 'document_summary',
           left(coalesce((select s.summary from public.document_summaries s where s.document_id = c.document_id limit 1), c.title, 'Document summary unavailable'), 4000),
           dae.avg_embedding,
           jsonb_build_object('repair_source','db_repair','anchored',true,'derived_embedding','avg_chunk_embedding'),
           encode(digest(coalesce((select s.summary from public.document_summaries s where s.document_id = c.document_id limit 1), c.title, 'Document summary unavailable'),'sha256'),'hex')
    from candidate_docs c
    join doc_avg_embedding dae on dae.document_id = c.document_id
    where not exists (select 1 from public.document_embedding_fields e where e.document_id = c.document_id and e.field_type = 'document_summary')
    returning document_id
  ),
  ensured_index_units_section as (
    insert into public.document_index_units (id, owner_id, document_id, unit_type, source_chunk_id, source_image_id, page_start, page_end, heading_path, title, content, normalized_terms, source_span, quality_score, extraction_mode, embedding, metadata)
    select gen_random_uuid(), c.owner_id, s.document_id, 'section_summary',
           (select ch.id from public.document_chunks ch where ch.id = any(s.chunk_ids) order by ch.chunk_index asc limit 1),
           null, s.page_start, s.page_end, coalesce(s.heading_path, array[s.heading]::text[]),
           left(coalesce(nullif(trim(s.heading),''), 'Section summary'), 200), left(s.summary, 4000),
           array_remove(regexp_split_to_array(lower(coalesce(s.heading,'')), '\\W+'), '')::text[],
           jsonb_build_object('anchor','section','section_id',s.id,'chunk_ids',s.chunk_ids),
           0.72, 'deterministic',
           coalesce((select ch.embedding from public.document_chunks ch where ch.id = any(s.chunk_ids) and ch.embedding is not null order by ch.chunk_index asc limit 1), dae.avg_embedding),
           jsonb_build_object('repair_source','db_repair','anchored',true,'unit_origin','section_summary')
    from public.document_sections s
    join candidate_docs c on c.document_id = s.document_id
    left join doc_avg_embedding dae on dae.document_id = s.document_id
    where length(trim(coalesce(s.summary,''))) > 0
      and coalesce((select ch.embedding from public.document_chunks ch where ch.id = any(s.chunk_ids) and ch.embedding is not null order by ch.chunk_index asc limit 1), dae.avg_embedding) is not null
      and not exists (select 1 from public.document_index_units u where u.document_id = s.document_id and u.unit_type = 'section_summary')
    returning document_id
  ),
  ensured_index_units_table as (
    insert into public.document_index_units (id, owner_id, document_id, unit_type, source_chunk_id, source_image_id, page_start, page_end, heading_path, title, content, normalized_terms, source_span, quality_score, extraction_mode, embedding, metadata)
    select gen_random_uuid(), tf.owner_id, tf.document_id, 'table_fact', tf.source_chunk_id, tf.source_image_id,
           tf.page_number, tf.page_number, array[coalesce(tf.table_title,'Table')]::text[],
           left(coalesce(tf.table_title, 'Table fact'), 200),
           left(concat_ws(' | ', nullif(tf.row_label,''), nullif(tf.clinical_parameter,''), nullif(tf.threshold_value,''), nullif(tf.action,'')), 4000),
           coalesce(tf.normalized_terms, '{}'::text[]),
           jsonb_build_object('anchor','table_fact','table_fact_id',tf.id,'page',tf.page_number,'source_image_id',tf.source_image_id),
           0.78, 'hybrid',
           coalesce((select ch.embedding from public.document_chunks ch where ch.id = tf.source_chunk_id and ch.embedding is not null), dae.avg_embedding),
           jsonb_build_object('repair_source','db_repair','anchored',true,'unit_origin','table_fact')
    from public.document_table_facts tf
    join candidate_docs c on c.document_id = tf.document_id
    left join doc_avg_embedding dae on dae.document_id = tf.document_id
    where length(trim(concat_ws(' ', nullif(tf.row_label,''), nullif(tf.clinical_parameter,''), nullif(tf.threshold_value,''), nullif(tf.action,'')))) > 0
      and coalesce((select ch.embedding from public.document_chunks ch where ch.id = tf.source_chunk_id and ch.embedding is not null), dae.avg_embedding) is not null
      and not exists (
        select 1 from public.document_index_units u
        where u.document_id = tf.document_id and u.unit_type = 'table_fact' and u.source_span ->> 'table_fact_id' = tf.id::text
      )
    returning document_id
  ),
  ensured_index_units_questions as (
    insert into public.document_index_units (id, owner_id, document_id, unit_type, source_chunk_id, source_image_id, page_start, page_end, heading_path, title, content, normalized_terms, source_span, quality_score, extraction_mode, embedding, metadata)
    select gen_random_uuid(), c.owner_id, ch.document_id, 'askable_question', ch.id, null, ch.page_number, ch.page_number,
           coalesce(ch.section_path, array[coalesce(ch.section_heading,'Section')]::text[]), 'Askable question',
           left(regexp_replace(ch.content, E'\\s+', ' ', 'g'), 4000),
           array_remove(regexp_split_to_array(lower(coalesce(ch.section_heading,'')), '\\W+'), '')::text[],
           jsonb_build_object('anchor','chunk','chunk_id',ch.id,'page',ch.page_number), 0.66, 'deterministic', ch.embedding,
           jsonb_build_object('repair_source','db_repair','anchored',true,'unit_origin','question_like_chunk')
    from candidate_docs c
    join lateral (
      select ch.* from public.document_chunks ch
      where ch.document_id = c.document_id and ch.embedding is not null and ch.content ~* '\\?'
      order by ch.chunk_index asc limit 2
    ) ch on true
    where not exists (select 1 from public.document_index_units u where u.document_id = ch.document_id and u.unit_type = 'askable_question' and u.source_chunk_id = ch.id)
    returning document_id
  ),
  gate as (
    select c.document_id,
           exists (select 1 from public.document_memory_cards mc where mc.document_id = c.document_id) as has_memory,
           exists (select 1 from public.document_sections s where s.document_id = c.document_id) as has_sections,
           exists (select 1 from public.document_embedding_fields e where e.document_id = c.document_id and e.field_type = 'document_title') as has_title_emb,
           exists (select 1 from public.document_embedding_fields e where e.document_id = c.document_id and e.field_type = 'document_summary') as has_summary_emb,
           exists (select 1 from public.document_index_units u where u.document_id = c.document_id and u.unit_type in ('section_summary','clinical_fact','threshold','workflow_step','medication_monitoring','askable_question','table_fact','alias','vocabulary_term')) as has_canonical_units
    from candidate_docs c
  ),
  upsert_quality as (
    insert into public.document_index_quality (document_id, owner_id, quality_score, extraction_quality, metrics, issues, updated_at, retrievable_visual_hit, typed_unit_coverage, anchor_coverage, source_span_coverage, model_fallback_rate, noisy_unit_rate)
    select g.document_id, d.owner_id,
           case when g.has_memory and g.has_sections and g.has_title_emb and g.has_summary_emb and g.has_canonical_units then 0.84 else 0.68 end,
           case when g.has_memory and g.has_sections and g.has_title_emb and g.has_summary_emb and g.has_canonical_units then 'good' else 'partial' end,
           jsonb_build_object('memory_cards', g.has_memory, 'sections', g.has_sections, 'title_embedding', g.has_title_emb, 'summary_embedding', g.has_summary_emb, 'canonical_units', g.has_canonical_units, 'quality_gate','db_repair_v1'),
           array_remove(array[
             case when not g.has_memory then 'no memory cards' end,
             case when not g.has_sections then 'no structured sections' end,
             case when not g.has_title_emb then 'missing document title embedding' end,
             case when not g.has_summary_emb then 'missing document summary embedding' end,
             case when not g.has_canonical_units then 'missing canonical index units' end
           ]::text[], null),
           now(), false,
           case when g.has_canonical_units then 1.0 else 0.0 end,
           case when g.has_sections then 1.0 else 0.0 end,
           case when g.has_canonical_units then 1.0 else 0.0 end,
           0.0, 0.0
    from gate g join public.documents d on d.id = g.document_id
    on conflict (document_id) do update set
      quality_score = excluded.quality_score,
      extraction_quality = excluded.extraction_quality,
      metrics = excluded.metrics,
      issues = excluded.issues,
      updated_at = excluded.updated_at,
      retrievable_visual_hit = excluded.retrievable_visual_hit,
      typed_unit_coverage = excluded.typed_unit_coverage,
      anchor_coverage = excluded.anchor_coverage,
      source_span_coverage = excluded.source_span_coverage,
      model_fallback_rate = excluded.model_fallback_rate,
      noisy_unit_rate = excluded.noisy_unit_rate
    returning document_id, extraction_quality
  ),
  defer_jobs as (
    update public.ingestion_jobs j
    set status = case when q.extraction_quality = 'good' then j.status else 'pending' end,
        stage = case when q.extraction_quality = 'good' then 'indexed + enrichment backfill v3' else 'indexed; enrichment deferred' end,
        error_message = case when q.extraction_quality = 'good' then null else 'quality gate: missing required enrichment artifacts' end,
        updated_at = now(),
        next_run_at = case when q.extraction_quality = 'good' then j.next_run_at else now() + interval '10 minutes' end
    from (select uq.document_id, uq.extraction_quality from upsert_quality uq) q
    where j.id = (select j2.id from public.ingestion_jobs j2 where j2.document_id = q.document_id order by j2.created_at desc limit 1)
    returning j.document_id
  )
  select jsonb_build_object(
    'processed_docs', (select count(*) from candidate_docs),
    'summaries_inserted', (select count(*) from ensured_summary),
    'sections_inserted', (select count(*) from ensured_sections),
    'memory_cards_inserted', (select count(*) from ensured_memory_cards),
    'title_embeddings_inserted', (select count(*) from ensured_title_embedding),
    'summary_embeddings_inserted', (select count(*) from ensured_summary_embedding),
    'section_units_inserted', (select count(*) from ensured_index_units_section),
    'table_units_inserted', (select count(*) from ensured_index_units_table),
    'question_units_inserted', (select count(*) from ensured_index_units_questions),
    'quality_rows_upserted', (select count(*) from upsert_quality),
    'jobs_gated', (select count(*) from defer_jobs),
    'good_after_gate', (select count(*) from upsert_quality where extraction_quality = 'good'),
    'partial_after_gate', (select count(*) from upsert_quality where extraction_quality <> 'good')
  ) into v_result;

  return v_result;
end;
$function$;


CREATE OR REPLACE FUNCTION public.repair_strict_enrichment_gate_batch(p_limit integer DEFAULT 50)
 RETURNS TABLE(document_id uuid, missing text[], repaired text[], status text, counts jsonb, presence jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  return query
  with candidates as (
    select g.*
    from public.document_strict_gate_status g
    where g.document_status = 'indexed'
      and (
        (
          g.gate_passed
          and (
            coalesce(g.enrichment_status, '') <> 'completed'
            or coalesce(g.indexing_v3_agent_status, '') <> 'completed'
            or coalesce(g.quality_extraction_quality, '') <> 'good'
            or exists (
              select 1
              from public.ingestion_jobs j
              where j.document_id = g.document_id
                and j.status in ('pending', 'processing')
            )
          )
        )
        or (
          not g.gate_passed
          and (
            coalesce(g.enrichment_status, '') = 'completed'
            or coalesce(g.indexing_v3_agent_status, '') = 'completed'
          )
        )
      )
    order by g.document_updated_at asc nulls first, g.document_id
    limit greatest(1, least(coalesce(p_limit, 50), 500))
  ),
  updated_documents as (
    update public.documents d
    set
      metadata = case
        when c.gate_passed then
          jsonb_strip_nulls(
            (coalesce(d.metadata, '{}'::jsonb)
              - 'indexing_v3_agent_locked_by'
              - 'indexing_v3_agent_locked_at'
              - 'indexing_v3_agent_next_run_at'
              - 'indexing_v3_agent_last_error'
              - 'completion_gate_missing')
            || jsonb_build_object(
              'indexing_v3_agent_status', 'completed',
              'indexing_v3_agent_updated_at', now(),
              'indexing_v3_agent_deferral_count', 0,
              'completion_gate', jsonb_build_object(
                'result', 'complete',
                'missing', to_jsonb(c.missing),
                'counts', c.counts,
                'presence', c.presence,
                'source', 'repair_strict_enrichment_gate_batch'
              ),
              'enrichment_status', 'completed'
            )
          )
        else
          jsonb_strip_nulls(
            (coalesce(d.metadata, '{}'::jsonb)
              - 'indexing_v3_agent_locked_by'
              - 'indexing_v3_agent_locked_at'
              - 'indexing_v3_agent_next_run_at'
              - 'indexing_v3_agent_last_error')
            || jsonb_build_object(
              'indexing_v3_agent_status', 'deferred',
              'indexing_v3_agent_updated_at', now(),
              'completion_gate_missing', to_jsonb(c.missing),
              'completion_gate', jsonb_build_object(
                'result', 'deferred',
                'missing', to_jsonb(c.missing),
                'counts', c.counts,
                'presence', c.presence,
                'source', 'repair_strict_enrichment_gate_batch'
              ),
              'enrichment_status', 'pending'
            )
          )
      end,
      updated_at = now()
    from candidates c
    where d.id = c.document_id
    returning d.id
  ),
  quality_promotions as (
    insert into public.document_index_quality (
      document_id,
      owner_id,
      quality_score,
      extraction_quality,
      metrics,
      issues,
      updated_at
    )
    select
      c.document_id,
      c.owner_id,
      greatest(c.quality_score, 1)::real,
      'good',
      jsonb_build_object(
        'strict_enrichment_gate', jsonb_build_object(
          'result', 'complete',
          'counts', c.counts,
          'presence', c.presence,
          'source', 'repair_strict_enrichment_gate_batch'
        )
      ),
      '{}'::text[],
      now()
    from candidates c
    where c.gate_passed
    on conflict (document_id)
    do update set
      quality_score = greatest(public.document_index_quality.quality_score, excluded.quality_score),
      extraction_quality = 'good',
      metrics = coalesce(public.document_index_quality.metrics, '{}'::jsonb) || excluded.metrics,
      updated_at = now()
    returning document_id
  ),
  completed_open_jobs as (
    update public.ingestion_jobs j
    set
      status = 'completed',
      stage = 'indexed',
      progress = 100,
      error_message = null,
      locked_at = null,
      locked_by = null,
      completed_at = coalesce(j.completed_at, now()),
      updated_at = now()
    from candidates c
    where c.gate_passed
      and j.document_id = c.document_id
      and j.status in ('pending', 'processing')
    returning j.document_id
  ),
  deferred_open_jobs as (
    update public.ingestion_jobs j
    set
      status = 'pending',
      stage = 'strict_gate_deferred',
      progress = least(j.progress, 95),
      error_message = 'strict enrichment gate missing: ' || array_to_string(c.missing, ','),
      locked_at = null,
      locked_by = null,
      next_run_at = now(),
      completed_at = null,
      updated_at = now()
    from candidates c
    where not c.gate_passed
      and j.document_id = c.document_id
      and j.status in ('pending', 'processing')
    returning j.document_id
  ),
  queued_repair_jobs as (
    insert into public.ingestion_jobs (
      document_id,
      status,
      stage,
      progress,
      error_message,
      next_run_at
    )
    select
      c.document_id,
      'pending',
      'strict_gate_repair',
      95,
      'strict enrichment gate missing: ' || array_to_string(c.missing, ','),
      now()
    from candidates c
    where not c.gate_passed
      and not exists (
        select 1
        from public.ingestion_jobs j
        where j.document_id = c.document_id
          and j.status in ('pending', 'processing')
      )
    returning document_id
  )
  select
    c.document_id,
    c.missing,
    array_remove(array[
      case when c.gate_passed then 'metadata_completed' else 'metadata_deferred' end,
      case when c.gate_passed then 'quality_good' else null end,
      case when exists (select 1 from completed_open_jobs j where j.document_id = c.document_id) then 'open_jobs_completed' else null end,
      case when exists (select 1 from deferred_open_jobs j where j.document_id = c.document_id) then 'open_jobs_deferred' else null end,
      case when exists (select 1 from queued_repair_jobs j where j.document_id = c.document_id) then 'repair_job_queued' else null end
    ], null)::text[] as repaired,
    case when c.gate_passed then 'completed' else 'deferred' end as status,
    c.counts,
    c.presence
  from candidates c
  where exists (select 1 from updated_documents u where u.id = c.document_id)
  order by c.document_updated_at asc nulls first, c.document_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_all_visual_eval_cases(p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_total integer := 0;
  v_passed integer := 0;
  v_failed integer := 0;
  v_case record;
  v_result jsonb;
begin
  for v_case in
    select id
    from public.rag_visual_eval_cases
    where active = true
    order by created_at asc
  loop
    v_total := v_total + 1;
    v_result := public.run_visual_eval_case(v_case.id, p_limit);
    if coalesce((v_result->>'passed')::boolean, false) then
      v_passed := v_passed + 1;
    else
      v_failed := v_failed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'cases_run', v_total,
    'passed', v_passed,
    'failed', v_failed,
    'run_at', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_visual_eval_case(p_case_id uuid, p_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_case public.rag_visual_eval_cases%rowtype;
  v_hits integer := 0;
  v_top_hit boolean := false;
  v_passed boolean := false;
  v_payload jsonb := '[]'::jsonb;
begin
  select * into v_case
  from public.rag_visual_eval_cases
  where id = p_case_id
    and active = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'eval case not found or inactive');
  end if;

  with ranked as (
    select
      u.id,
      u.unit_type,
      u.title,
      u.content,
      u.source_image_id,
      i.image_type,
      ts_rank_cd(u.search_tsv, websearch_to_tsquery('english', v_case.query)) as rank_score
    from public.document_index_units u
    left join public.document_images i on i.id = u.source_image_id
    where u.document_id = v_case.document_id
      and (
        u.search_tsv @@ websearch_to_tsquery('english', v_case.query)
        or lower(coalesce(u.content,'')) like '%' || lower(v_case.query) || '%'
      )
    order by rank_score desc nulls last, u.quality_score desc nulls last
    limit greatest(1, least(coalesce(p_limit,8),50))
  )
  select
    count(*)::int,
    coalesce((
      select (r.unit_type = any(v_case.expected_unit_types))
      from ranked r
      order by r.rank_score desc nulls last
      limit 1
    ), false),
    coalesce(jsonb_agg(to_jsonb(ranked.*)), '[]'::jsonb)
  into v_hits, v_top_hit, v_payload
  from ranked
  where (
      cardinality(v_case.expected_unit_types) = 0
      or ranked.unit_type = any(v_case.expected_unit_types)
    )
    and (
      v_case.expected_image_type is null
      or ranked.image_type = v_case.expected_image_type
    )
    and (
      cardinality(v_case.expected_terms) = 0
      or exists (
        select 1
        from unnest(v_case.expected_terms) t
        where lower(ranked.content) like '%' || lower(t) || '%'
      )
    );

  v_passed := (v_hits > 0);

  insert into public.rag_visual_eval_runs (
    case_id,
    document_id,
    passed,
    top_hit,
    matched_count,
    hit_payload,
    run_metadata
  ) values (
    v_case.id,
    v_case.document_id,
    v_passed,
    v_top_hit,
    v_hits,
    v_payload,
    jsonb_build_object('query', v_case.query, 'limit', p_limit)
  );

  return jsonb_build_object(
    'ok', true,
    'case_id', v_case.id,
    'passed', v_passed,
    'top_hit', v_top_hit,
    'matched_count', v_hits,
    'hits', v_payload
  );
end;
$function$;

-- Preserve the production ACLs for live-only/captured RPCs. CREATE FUNCTION
-- grants PUBLIC execute by default on a fresh database unless explicitly revoked.
revoke execute on function public.get_visual_evidence_cards(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_visual_evidence_cards(uuid, integer) to service_role;

revoke execute on function public.match_document_table_facts_text(text, integer, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.match_document_table_facts_text(text, integer, uuid[], uuid) to service_role;

revoke execute on function public.repair_enrichment_quality_batch(integer)
  from public, anon, authenticated;
grant execute on function public.repair_enrichment_quality_batch(integer) to service_role;

revoke execute on function public.run_all_visual_eval_cases(integer)
  from public, anon, authenticated;
grant execute on function public.run_all_visual_eval_cases(integer) to service_role;

revoke execute on function public.run_visual_eval_case(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.run_visual_eval_case(uuid, integer) to service_role;

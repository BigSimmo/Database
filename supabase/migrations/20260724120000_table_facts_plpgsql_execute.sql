-- Byte-identical result set for match_document_table_facts_text, but plan with
-- the actual bound parameter values each call. LANGUAGE sql + SET search_path
-- made the body non-inlinable, so Postgres cached a generic plan that could not
-- estimate trigram/tsv selectivity for unknown $1 and paid ~1–5s instead of
-- ~70ms (see docs/scale-readiness-review.md F1). Dynamic EXECUTE forces a
-- one-shot custom plan. RAG impact: no retrieval behaviour change — result rows
-- and ordering predicates are unchanged.

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
  match_reason text
)
language plpgsql
stable
set search_path = public, extensions, pg_temp
set plan_cache_mode = 'force_custom_plan'
as $function$
begin
  return query execute $body$
  with query as (
    select
      websearch_to_tsquery('english', coalesce($1, '')) as tsq,
      lower(trim(regexp_replace(coalesce($1, ''), '\s+', ' ', 'g'))) as normalized,
      string_to_array(lower(trim(regexp_replace(coalesce($1, ''), '\s+', ' ', 'g'))), ' ')::text[] as tokens
  ),
  doc_scope as (
    select d.id, d.metadata
    from public.documents d
    where d.status = 'indexed'
      and public.retrieval_owner_matches($4, d.owner_id)
      and ($3 is null or d.id = any($3))
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
    limit greatest($2 * 5, 64)
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
    limit greatest($2 * 4, 48)
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
    limit greatest($2 * 4, 48)
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
  limit $2
  $body$
  using query_text, match_count, document_filters, owner_filter;
end;
$function$;

revoke execute on function public.match_document_table_facts_text(text, integer, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.match_document_table_facts_text(text, integer, uuid[], uuid) to service_role;

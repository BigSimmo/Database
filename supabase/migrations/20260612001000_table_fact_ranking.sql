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
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
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

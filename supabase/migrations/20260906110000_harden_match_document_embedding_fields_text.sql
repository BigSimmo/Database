-- Harden match_document_embedding_fields_text retrieval owner matching (#MDQZYV, #ZBAC9D).
--
-- Replaces loose `(owner_filter is null or d.owner_id = owner_filter)` with
-- `public.retrieval_owner_matches(owner_filter, d.owner_id)` so that:
-- 1. owner_filter IS NULL fails closed (returns false), preventing global cross-tenant bypass.
-- 2. The public sentinel ('00000000-0000-0000-0000-000000000000'::uuid) matches public corpus rows (row_owner_id IS NULL).
-- 3. Exact owner UUID matches only rows with that exact owner_id.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.match_document_embedding_fields_text(
  query_text text,
  match_count integer default 16,
  min_text_rank double precision default 0.0,
  document_filters uuid[] default null::uuid[],
  owner_filter uuid default null::uuid
)
returns table(
  id uuid,
  document_id uuid,
  source_chunk_id uuid,
  field_type text,
  content text,
  text_rank double precision
)
language sql
stable
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  with q as (select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq),
  ranked as (
    select f.id, f.document_id, f.source_chunk_id, f.field_type, f.content,
      ts_rank_cd(f.search_tsv, q.tsq)::double precision as text_rank
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    cross join q
    where f.source_chunk_id is not null
      and (document_filters is null or f.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed' and f.search_tsv @@ q.tsq
  )
  select * from ranked where text_rank >= min_text_rank
  order by text_rank desc, id limit match_count;
$function$;

revoke execute on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) to service_role;

comment on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) is
  'Matches indexed document embedding fields by text search using public.retrieval_owner_matches to fail closed on null owner and prevent cross-tenant leakage (#MDQZYV, #ZBAC9D).';

-- match_document_embedding_fields_text (codified from live drift in
-- 20260705230000) kept the legacy `(owner_filter is null or ...)` predicate,
-- so it ignores the public-owner sentinel every other retrieval function
-- honours via retrieval_owner_matches (20260705210000). Latent today (the app
-- only calls the _hybrid variant) but wrong the moment this RPC is wired in:
-- the sentinel would match zero rows and a real owner id would exclude public
-- documents. Recreate it with the shared owner predicate.
set search_path = public, extensions, pg_temp;

-- Replay guard: drop first in case the live/preview OUT signature drifted,
-- which makes `create or replace` fail during migration replay.
drop function if exists public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid);

create or replace function public.match_document_embedding_fields_text(
  query_text text, match_count integer default 16, min_text_rank double precision default 0.0,
  document_filters uuid[] default null, owner_filter uuid default null
)
returns table (
  id uuid, document_id uuid, source_chunk_id uuid, field_type text, content text, text_rank double precision
)
language sql stable set search_path = public, extensions, pg_temp
as $$
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
$$;

revoke execute on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) to service_role;

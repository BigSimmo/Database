-- Bound the result cardinality of the two versioned owner-plus-public retrieval
-- entry points. PostgREST permits explicitly-null RPC arguments; PostgreSQL
-- interprets LIMIT NULL (and a negative LIMIT) as no limit. Before this guard,
-- a malformed or compromised service-role caller could turn the final LIMIT
-- into an unbounded result within each helper's candidate window, multiplying
-- JSON hydration and response size on a hot retrieval path.
--
-- Keep the public signatures and defaults intact for generated types and
-- callers. The inner helpers already cap candidate work; this outer clamp
-- makes the exposed result contract deterministic: 1..96 rows.
--
-- Rollback / forward repair: re-create these wrappers from
-- 20260717160000_optimize_owner_public_retrieval.sql to restore the former
-- pass-through count behaviour. No data is changed.

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
  from public.match_document_chunks_text_scoped(
    $1,
    least(greatest(coalesce($2, 12), 1), 96),
    $3,
    $4,
    $5
  );
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
  from public.match_document_index_units_hybrid_scoped(
    $1,
    $2,
    least(greatest(coalesce($3, 24), 1), 96),
    $4,
    $5,
    $6,
    $7
  );
$$;

-- CREATE OR REPLACE preserves privileges in PostgreSQL, but re-state the
-- service-role-only contract so future function changes cannot reopen it.
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

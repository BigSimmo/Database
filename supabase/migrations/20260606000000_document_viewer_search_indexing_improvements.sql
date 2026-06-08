alter table public.document_chunks
  add column if not exists content_hash text,
  add column if not exists index_generation_id uuid;

create index if not exists document_chunks_generation_idx
  on public.document_chunks(document_id, index_generation_id);

create index if not exists document_chunks_content_hash_idx
  on public.document_chunks(document_id, content_hash);

create index if not exists document_chunks_content_trgm_idx
  on public.document_chunks using gin ((lower(coalesce(section_heading, '') || ' ' || content)) gin_trgm_ops);

create or replace function public.search_document_chunks(
  p_document_id uuid,
  p_query text,
  match_count integer default 20,
  p_owner_id uuid default null
)
returns table (
  id uuid,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  image_ids uuid[],
  text_rank real,
  trigram_score real
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with normalized as (
    select
      websearch_to_tsquery('english', coalesce(p_query, '')) as query_tsv,
      lower(trim(coalesce(p_query, ''))) as query_text
  )
  select
    c.id,
    c.page_number,
    c.chunk_index,
    c.section_heading,
    c.content,
    c.image_ids,
    ts_rank_cd(c.search_tsv, normalized.query_tsv)::real as text_rank,
    similarity(lower(coalesce(c.section_heading, '') || ' ' || c.content), normalized.query_text)::real as trigram_score
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  cross join normalized
  where c.document_id = p_document_id
    and d.status = 'indexed'
    and (p_owner_id is null or d.owner_id = p_owner_id)
    and (
      c.search_tsv @@ normalized.query_tsv
      or lower(coalesce(c.section_heading, '') || ' ' || c.content) % normalized.query_text
      or lower(coalesce(c.section_heading, '') || ' ' || c.content) like '%' || normalized.query_text || '%'
    )
  order by
    ts_rank_cd(c.search_tsv, normalized.query_tsv) desc,
    similarity(lower(coalesce(c.section_heading, '') || ' ' || c.content), normalized.query_text) desc,
    c.chunk_index asc
  limit least(greatest(match_count, 1), 80);
$$;

grant execute on function public.search_document_chunks(uuid, text, integer, uuid) to service_role;

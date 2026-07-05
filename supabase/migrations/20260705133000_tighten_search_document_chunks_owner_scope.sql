-- Tighten search_document_chunks owner scoping so null p_owner_id only matches public
-- documents (owner_id IS NULL) and authenticated callers can search both owned and public
-- documents without matching other owners' private rows.

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
  ),
  tokens as (
    select distinct token
    from normalized,
      lateral regexp_split_to_table(normalized.query_text, '\s+') as token
    where length(token) >= 3
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
    and (
      (p_owner_id is null and d.owner_id is null)
      or (p_owner_id is not null and (d.owner_id is null or d.owner_id = p_owner_id))
    )
    and (
      c.search_tsv @@ normalized.query_tsv
      or lower(coalesce(c.section_heading, '') || ' ' || c.content) % normalized.query_text
      or lower(coalesce(c.section_heading, '') || ' ' || c.content) like '%' || normalized.query_text || '%'
      or exists (
        select 1
        from tokens t
        where lower(coalesce(c.section_heading, '') || ' ' || c.content) like '%' || t.token || '%'
          or lower(coalesce(c.section_heading, '') || ' ' || c.content) % t.token
      )
    )
  order by
    ts_rank_cd(c.search_tsv, normalized.query_tsv) desc,
    similarity(lower(coalesce(c.section_heading, '') || ' ' || c.content), normalized.query_text) desc,
    c.chunk_index asc
  limit least(greatest(match_count, 1), 80);
$$;

grant execute on function public.search_document_chunks(uuid, text, integer, uuid) to service_role;

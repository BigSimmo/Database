-- Additive owner-plus-public retrieval wrappers. They delegate to the current
-- stable signatures and do not replace live-ahead retrieval bodies.

create or replace function public.retrieval_owner_matches_v2(
  owner_filter uuid,
  row_owner_id uuid,
  include_public boolean default true
)
returns boolean language sql immutable as $$
  select owner_filter is not null and (
    row_owner_id = owner_filter
    or (coalesce(include_public, false) and row_owner_id is null)
    or (owner_filter = '00000000-0000-0000-0000-000000000000'::uuid and row_owner_id is null)
  );
$$;

create or replace function public.corpus_topic_term_stats_v2(
  terms text[],
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  term text, has_ts_signal boolean, title_doc_count integer, chunk_present boolean, total_doc_count integer
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.corpus_topic_term_stats($1, $2)
    union all
    select * from public.corpus_topic_term_stats($1, '00000000-0000-0000-0000-000000000000'::uuid)
    where $3 and $2 <> '00000000-0000-0000-0000-000000000000'::uuid
  )
  select term, bool_or(has_ts_signal), sum(title_doc_count)::integer,
    bool_or(chunk_present), sum(total_doc_count)::integer
  from combined group by term order by term;
$$;

create or replace function public.match_document_chunks_text_v2(
  query_text text, match_count integer default 12, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, title text, file_name text, page_number integer,
  chunk_index integer, section_heading text, content text, retrieval_synopsis text,
  image_ids uuid[], source_metadata jsonb, document_labels jsonb, document_summary text,
  similarity double precision, text_rank double precision, hybrid_score double precision,
  lexical_score double precision, images jsonb
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select id, document_id, title, file_name, page_number, chunk_index, section_heading, content,
      retrieval_synopsis, image_ids, source_metadata, document_labels, document_summary,
      similarity, text_rank, hybrid_score, hybrid_score as lexical_score, images
    from public.match_document_chunks_text($1, $2, $3, $4)
    union all
    select id, document_id, title, file_name, page_number, chunk_index, section_heading, content,
      retrieval_synopsis, image_ids, source_metadata, document_labels, document_summary,
      similarity, text_rank, hybrid_score, hybrid_score as lexical_score, images
    from public.match_document_chunks_text($1, $2, $3, '00000000-0000-0000-0000-000000000000'::uuid)
    where $5 and $4 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), deduped as (
    select *, row_number() over (partition by id order by hybrid_score desc, text_rank desc) as access_rank
    from combined
  )
  select id, document_id, title, file_name, page_number, chunk_index, section_heading, content,
    retrieval_synopsis, image_ids, source_metadata, document_labels, document_summary,
    similarity, text_rank, hybrid_score, lexical_score, images
  from deduped where access_rank = 1
  order by hybrid_score desc, text_rank desc, id
  limit greatest(1, least($2, 100));
$$;

create or replace function public.match_document_chunks_hybrid_v2(
  query_embedding extensions.vector(1536), query_text text, match_count integer default 12,
  min_similarity double precision default 0.12, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, title text, file_name text, page_number integer,
  chunk_index integer, section_heading text, content text, retrieval_synopsis text,
  image_ids uuid[], source_metadata jsonb, similarity double precision,
  text_rank double precision, hybrid_score double precision, rrf_score double precision, images jsonb
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_chunks_hybrid($1, $2, $3, $4, $5, $6)
    union all
    select * from public.match_document_chunks_hybrid($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000'::uuid)
    where $7 and $6 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), deduped as (
    select *, row_number() over (partition by id order by hybrid_score desc, rrf_score desc) as access_rank
    from combined
  )
  select id, document_id, title, file_name, page_number, chunk_index, section_heading, content,
    retrieval_synopsis, image_ids, source_metadata, similarity, text_rank, hybrid_score, rrf_score, images
  from deduped where access_rank = 1
  order by hybrid_score desc, rrf_score desc, id
  limit greatest(1, least($3, 100));
$$;

create or replace function public.match_document_chunks_v2(
  query_embedding extensions.vector(1536), match_count integer default 8,
  min_similarity double precision default 0.15, document_filter uuid default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, title text, file_name text, page_number integer,
  chunk_index integer, section_heading text, content text, retrieval_synopsis text,
  image_ids uuid[], source_metadata jsonb, document_labels jsonb, document_summary text,
  similarity double precision, images jsonb
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_chunks($1, $2, $3, $4, $5)
    union all
    select * from public.match_document_chunks($1, $2, $3, $4, '00000000-0000-0000-0000-000000000000'::uuid)
    where $6 and $5 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), deduped as (
    select *, row_number() over (partition by id order by similarity desc) as access_rank
    from combined
  )
  select id, document_id, title, file_name, page_number, chunk_index, section_heading, content,
    retrieval_synopsis, image_ids, source_metadata, document_labels, document_summary, similarity, images
  from deduped where access_rank = 1
  order by similarity desc, id
  limit greatest(1, least($2, 100));
$$;

create or replace function public.get_related_document_metadata_v2(
  document_ids uuid[],
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (document_id uuid, labels jsonb, summary text)
language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.get_related_document_metadata($1, $2)
    union all
    select * from public.get_related_document_metadata($1, '00000000-0000-0000-0000-000000000000'::uuid)
    where $3 and $2 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), deduped as (
    select *, row_number() over (partition by document_id order by document_id) as access_rank from combined
  )
  select document_id, labels, summary from deduped where access_rank = 1 order by document_id;
$$;

create or replace function public.match_document_lookup_chunks_text_v2(
  query_text text, document_filters uuid[], match_count integer default 24,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, page_number integer, chunk_index integer, section_heading text,
  section_path text[], heading_level integer, parent_heading text, anchor_id text, content text,
  retrieval_synopsis text, image_ids uuid[], text_rank double precision
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_lookup_chunks_text($1, $2, $3, $4)
    union all
    select * from public.match_document_lookup_chunks_text($1, $2, $3, '00000000-0000-0000-0000-000000000000'::uuid)
    where $5 and $4 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by text_rank desc) access_rank from combined)
  select id, document_id, page_number, chunk_index, section_heading, section_path, heading_level,
    parent_heading, anchor_id, content, retrieval_synopsis, image_ids, text_rank
  from ranked where access_rank = 1 order by text_rank desc, id limit greatest(1, least($3, 100));
$$;

create or replace function public.match_documents_for_query_v2(
  query_text text, match_count integer default 12,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, owner_id uuid, title text, file_name text, status text, page_count integer,
  chunk_count integer, image_count integer, metadata jsonb, text_rank double precision, match_reason text
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_documents_for_query($1, $2, $3)
    union all
    select * from public.match_documents_for_query($1, $2, '00000000-0000-0000-0000-000000000000'::uuid)
    where $4 and $3 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by text_rank desc) access_rank from combined)
  select id, owner_id, title, file_name, status, page_count, chunk_count, image_count, metadata, text_rank, match_reason
  from ranked where access_rank = 1 order by text_rank desc, id limit greatest(1, least($2, 100));
$$;

create or replace function public.match_document_table_facts_text_v2(
  query_text text, match_count integer default 16, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, source_chunk_id uuid, source_image_id uuid, page_number integer,
  table_title text, row_label text, clinical_parameter text, threshold_value text, action text,
  text_rank double precision, match_reason text, metadata jsonb
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_table_facts_text($1, $2, $3, $4)
    union all
    select * from public.match_document_table_facts_text($1, $2, $3, '00000000-0000-0000-0000-000000000000'::uuid)
    where $5 and $4 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by text_rank desc) access_rank from combined)
  select id, document_id, source_chunk_id, source_image_id, page_number, table_title, row_label,
    clinical_parameter, threshold_value, action, text_rank, match_reason, metadata
  from ranked where access_rank = 1 order by text_rank desc, id limit greatest(1, least($2, 100));
$$;

create or replace function public.match_document_embedding_fields_hybrid_v2(
  query_embedding extensions.vector(1536), query_text text, match_count integer default 16,
  min_similarity double precision default 0.5, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, source_chunk_id uuid, field_type text, content text,
  similarity double precision, text_rank double precision, hybrid_score double precision
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_embedding_fields_hybrid($1, $2, $3, $4, $5, $6)
    union all
    select * from public.match_document_embedding_fields_hybrid($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000'::uuid)
    where $7 and $6 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by hybrid_score desc) access_rank from combined)
  select id, document_id, source_chunk_id, field_type, content, similarity, text_rank, hybrid_score
  from ranked where access_rank = 1 order by hybrid_score desc, id limit greatest(1, least($3, 100));
$$;

create or replace function public.match_document_index_units_hybrid_v2(
  query_embedding extensions.vector(1536), query_text text, match_count integer default 24,
  min_similarity double precision default 0.1, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, source_chunk_id uuid, source_image_id uuid, unit_type text, title text,
  content text, page_start integer, page_end integer, heading_path text[], normalized_terms text[],
  source_span jsonb, quality_score real, extraction_mode text, similarity double precision,
  text_rank double precision, hybrid_score double precision, metadata jsonb
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_index_units_hybrid($1, $2, $3, $4, $5, $6)
    union all
    select * from public.match_document_index_units_hybrid($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000'::uuid)
    where $7 and $6 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by hybrid_score desc) access_rank from combined)
  select id, document_id, source_chunk_id, source_image_id, unit_type, title, content, page_start, page_end,
    heading_path, normalized_terms, source_span, quality_score, extraction_mode, similarity, text_rank, hybrid_score, metadata
  from ranked where access_rank = 1 order by hybrid_score desc, id limit greatest(1, least($3, 100));
$$;

create or replace function public.match_document_memory_cards_hybrid_v3(
  query_embedding extensions.vector(1536), query_text text, match_count integer default 32,
  min_similarity double precision default 0.1, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, owner_id uuid, section_id uuid, card_type text, title text, content text,
  normalized_terms text[], page_number integer, source_chunk_ids uuid[], source_image_ids uuid[], confidence real,
  metadata jsonb, similarity double precision, text_rank double precision, hybrid_score double precision, rrf_score double precision
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_memory_cards_hybrid_v2($1, $2, $3, $4, $5, $6)
    union all
    select * from public.match_document_memory_cards_hybrid_v2($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000'::uuid)
    where $7 and $6 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by hybrid_score desc, rrf_score desc) access_rank from combined)
  select id, document_id, owner_id, section_id, card_type, title, content, normalized_terms, page_number,
    source_chunk_ids, source_image_ids, confidence, metadata, similarity, text_rank, hybrid_score, rrf_score
  from ranked where access_rank = 1 order by hybrid_score desc, rrf_score desc, id limit greatest(1, least($3, 100));
$$;

revoke all on function public.retrieval_owner_matches_v2(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.corpus_topic_term_stats_v2(text[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_chunks_text_v2(text, integer, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_chunks_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_chunks_v2(extensions.vector, integer, double precision, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_related_document_metadata_v2(uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_lookup_chunks_text_v2(text, uuid[], integer, uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_documents_for_query_v2(text, integer, uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_table_facts_text_v2(text, integer, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_embedding_fields_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_index_units_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_memory_cards_hybrid_v3(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) from public, anon, authenticated;
grant execute on function public.retrieval_owner_matches_v2(uuid, uuid, boolean) to service_role;
grant execute on function public.corpus_topic_term_stats_v2(text[], uuid, boolean) to service_role;
grant execute on function public.match_document_chunks_text_v2(text, integer, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_chunks_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_chunks_v2(extensions.vector, integer, double precision, uuid, uuid, boolean) to service_role;
grant execute on function public.get_related_document_metadata_v2(uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_lookup_chunks_text_v2(text, uuid[], integer, uuid, boolean) to service_role;
grant execute on function public.match_documents_for_query_v2(text, integer, uuid, boolean) to service_role;
grant execute on function public.match_document_table_facts_text_v2(text, integer, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_embedding_fields_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_index_units_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_memory_cards_hybrid_v3(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) to service_role;

do $$
begin
  if public.retrieval_owner_matches_v2(null, null, true)
    or not public.retrieval_owner_matches_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, true)
    or not public.retrieval_owner_matches_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true)
    or public.retrieval_owner_matches_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true)
  then raise exception 'retrieval_owner_matches_v2 truth table failed'; end if;
end $$;

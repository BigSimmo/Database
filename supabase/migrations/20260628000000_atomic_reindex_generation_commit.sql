alter table public.document_chunks
  drop constraint if exists document_chunks_document_id_chunk_index_key;

create unique index if not exists document_chunks_document_generation_chunk_idx
  on public.document_chunks(document_id, index_generation_id, chunk_index)
  where index_generation_id is not null;

create or replace function public.is_committed_document_generation(
  row_generation uuid,
  document_metadata jsonb
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select row_generation is null
    or row_generation::text = nullif(coalesce(document_metadata, '{}'::jsonb)->>'index_generation_id', '');
$$;

create or replace function public.is_committed_artifact_generation(
  artifact_metadata jsonb,
  document_metadata jsonb
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select nullif(coalesce(artifact_metadata, '{}'::jsonb)->>'index_generation_id', '') is null
    or nullif(coalesce(artifact_metadata, '{}'::jsonb)->>'index_generation_id', '') =
      nullif(coalesce(document_metadata, '{}'::jsonb)->>'index_generation_id', '');
$$;

create or replace function public.commit_document_index_generation(
  p_document_id uuid,
  p_index_generation_id uuid,
  p_status text default 'indexed',
  p_page_count integer default 0,
  p_chunk_count integer default 0,
  p_image_count integer default 0,
  p_metadata jsonb default '{}'::jsonb,
  p_pages jsonb default null,
  p_quality jsonb default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  perform set_config('statement_timeout', '180000', true);

  update public.documents
  set
    status = p_status,
    page_count = p_page_count,
    chunk_count = p_chunk_count,
    image_count = p_image_count,
    error_message = null,
    metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', p_index_generation_id),
    updated_at = now()
  where id = p_document_id;

  if p_pages is not null then
    delete from public.document_pages
    where document_id = p_document_id;

    insert into public.document_pages (document_id, page_number, text, ocr_used, metadata)
    select
      p_document_id,
      page_row.page_number,
      coalesce(page_row.text, ''),
      coalesce(page_row.ocr_used, false),
      coalesce(page_row.metadata, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_pages, '[]'::jsonb)) as page_row(
      page_number integer,
      text text,
      ocr_used boolean,
      metadata jsonb
    )
    where page_row.page_number is not null;
  end if;

  if p_quality is not null then
    insert into public.document_index_quality (
      document_id,
      owner_id,
      quality_score,
      extraction_quality,
      metrics,
      issues,
      updated_at
    )
    values (
      p_document_id,
      nullif(p_quality->>'owner_id', '')::uuid,
      coalesce((p_quality->>'quality_score')::real, 0),
      coalesce(nullif(p_quality->>'extraction_quality', ''), 'unknown'),
      coalesce(p_quality->'metrics', '{}'::jsonb),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(p_quality->'issues', '[]'::jsonb))),
        '{}'::text[]
      ),
      now()
    )
    on conflict on constraint document_index_quality_pkey
    do update set
      owner_id = excluded.owner_id,
      quality_score = excluded.quality_score,
      extraction_quality = excluded.extraction_quality,
      metrics = excluded.metrics,
      issues = excluded.issues,
      updated_at = excluded.updated_at;
  end if;

  delete from public.document_chunks
  where document_id = p_document_id
    and (index_generation_id is null or index_generation_id <> p_index_generation_id);

  delete from public.document_images
  where document_id = p_document_id
    and (
      nullif(metadata->>'index_generation_id', '') is null
      or metadata->>'index_generation_id' <> p_index_generation_id::text
    );

  delete from public.document_table_facts
  where document_id = p_document_id
    and (
      nullif(metadata->>'index_generation_id', '') is null
      or metadata->>'index_generation_id' <> p_index_generation_id::text
    );

  delete from public.document_embedding_fields
  where document_id = p_document_id
    and (
      nullif(metadata->>'index_generation_id', '') is null
      or metadata->>'index_generation_id' <> p_index_generation_id::text
    );

  delete from public.document_index_units
  where document_id = p_document_id
    and (
      nullif(metadata->>'index_generation_id', '') is null
      or metadata->>'index_generation_id' <> p_index_generation_id::text
    );

  delete from public.document_memory_cards
  where document_id = p_document_id
    and (
      nullif(metadata->>'index_generation_id', '') is null
      or metadata->>'index_generation_id' <> p_index_generation_id::text
    );

  delete from public.document_sections
  where document_id = p_document_id
    and (
      nullif(metadata->>'index_generation_id', '') is null
      or metadata->>'index_generation_id' <> p_index_generation_id::text
    );

  return jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'index_generation_id', p_index_generation_id
  );
end;
$$;

grant execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.is_committed_document_generation(uuid, jsonb) to service_role;
grant execute on function public.is_committed_artifact_generation(jsonb, jsonb) to service_role;

do $$
declare
  ddl text;
  patched text;
begin
  select pg_get_functiondef('public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid)'::regprocedure) into ddl;
  patched := replace(
    ddl,
    E'    and d.status = ''indexed''\n    and 1 - (c.embedding <=> query_embedding) >= min_similarity',
    E'    and d.status = ''indexed''\n    and public.is_committed_document_generation(c.index_generation_id, d.metadata)\n    and 1 - (c.embedding <=> query_embedding) >= min_similarity'
  );
  if patched = ddl then raise exception 'atomic reindex patch did not match match_document_chunks'; end if;
  execute patched;

  select pg_get_functiondef('public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)'::regprocedure) into ddl;
  patched := replace(
    ddl,
    E'      and d.status = ''indexed''\n      and 1 - (c.embedding <=> query_embedding) >= min_similarity',
    E'      and d.status = ''indexed''\n      and public.is_committed_document_generation(c.index_generation_id, d.metadata)\n      and 1 - (c.embedding <=> query_embedding) >= min_similarity'
  );
  patched := replace(
    patched,
    E'      and d.status = ''indexed''\n      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)',
    E'      and d.status = ''indexed''\n      and public.is_committed_document_generation(c.index_generation_id, d.metadata)\n      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)'
  );
  if patched = ddl then raise exception 'atomic reindex patch did not match match_document_chunks_hybrid'; end if;
  execute patched;

  select pg_get_functiondef('public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)'::regprocedure) into ddl;
  patched := replace(
    ddl,
    E'      and d.status = ''indexed''\n      and 1 - (m.embedding <=> query_embedding) >= min_similarity',
    E'      and d.status = ''indexed''\n      and public.is_committed_artifact_generation(m.metadata, d.metadata)\n      and 1 - (m.embedding <=> query_embedding) >= min_similarity'
  );
  patched := replace(
    patched,
    E'      and d.status = ''indexed''\n      and m.search_tsv @@ query.tsq',
    E'      and d.status = ''indexed''\n      and public.is_committed_artifact_generation(m.metadata, d.metadata)\n      and m.search_tsv @@ query.tsq'
  );
  if patched = ddl then raise exception 'atomic reindex patch did not match match_document_memory_cards_hybrid'; end if;
  execute patched;

  select pg_get_functiondef('public.match_document_chunks_text(text, integer, uuid[], uuid)'::regprocedure) into ddl;
  patched := replace(
    ddl,
    E'      and d.status = ''indexed''\n      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)',
    E'      and d.status = ''indexed''\n      and public.is_committed_document_generation(c.index_generation_id, d.metadata)\n      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)'
  );
  if patched = ddl then raise exception 'atomic reindex patch did not match match_document_chunks_text'; end if;
  execute patched;

  select pg_get_functiondef('public.match_document_lookup_chunks_text(text, uuid[], integer, uuid)'::regprocedure) into ddl;
  patched := replace(
    ddl,
    E'    and d.status = ''indexed''\n    and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)',
    E'    and d.status = ''indexed''\n    and public.is_committed_document_generation(c.index_generation_id, d.metadata)\n    and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)'
  );
  if patched = ddl then raise exception 'atomic reindex patch did not match match_document_lookup_chunks_text'; end if;
  execute patched;

  select pg_get_functiondef('public.match_document_table_facts_text(text, integer, uuid[], uuid)'::regprocedure) into ddl;
  patched := replace(
    ddl,
    E'      and d.status = ''indexed''\n      and (',
    E'      and d.status = ''indexed''\n      and public.is_committed_artifact_generation(f.metadata, d.metadata)\n      and ('
  );
  if patched = ddl then raise exception 'atomic reindex patch did not match match_document_table_facts_text'; end if;
  execute patched;

  select pg_get_functiondef('public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)'::regprocedure) into ddl;
  patched := replace(
    ddl,
    E'      and d.status = ''indexed''\n      and f.source_chunk_id is not null',
    E'      and d.status = ''indexed''\n      and public.is_committed_artifact_generation(f.metadata, d.metadata)\n      and f.source_chunk_id is not null'
  );
  if patched = ddl then raise exception 'atomic reindex patch did not match match_document_embedding_fields_hybrid'; end if;
  execute patched;

  select pg_get_functiondef('public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)'::regprocedure) into ddl;
  patched := replace(
    ddl,
    E'    where d.status = ''indexed''\n      and (document_filters is null or u.document_id = any(document_filters))\n      and (owner_filter is null or u.owner_id = owner_filter)\n      and u.source_chunk_id is not null',
    E'    where d.status = ''indexed''\n      and (document_filters is null or u.document_id = any(document_filters))\n      and (owner_filter is null or u.owner_id = owner_filter)\n      and public.is_committed_artifact_generation(u.metadata, d.metadata)\n      and u.source_chunk_id is not null'
  );
  if patched = ddl then raise exception 'atomic reindex patch did not match match_document_index_units_hybrid'; end if;
  execute patched;
end;
$$;

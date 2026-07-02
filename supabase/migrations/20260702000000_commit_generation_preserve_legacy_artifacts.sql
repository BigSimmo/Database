-- Audit M13 (repo audit 2026-07-01): commit_document_index_generation used to
-- delete legacy NULL-generation rows unconditionally. Rows created before
-- generation tracking existed carry no index_generation_id, and retrieval
-- treats NULL as committed/visible (is_committed_artifact_generation), so a
-- reindex pass that transiently produced no replacement rows for a category
-- (e.g. an image-extraction failure that still committed status='indexed')
-- permanently destroyed the previously-good legacy artifacts with no rollback.
--
-- This migration recreates the function so legacy NULL-generation rows are
-- purged ONLY when the new generation actually produced replacement rows in
-- the same table. Rows tagged with a different (superseded) generation are
-- still always removed. On the next successful reindex that produces rows,
-- the retained legacy rows are purged as before.
--
-- Scope of the guarantee (per FK topology): document_images (no chunk FK),
-- document_memory_cards (section_id ON DELETE SET NULL), and
-- document_sections are fully protected. document_table_facts,
-- document_embedding_fields, and document_index_units reference
-- document_chunks(id) ON DELETE CASCADE, so when legacy chunks are replaced
-- (the normal case — the worker inserts chunks before committing) their
-- legacy chunk-anchored rows cascade away with them regardless of these
-- guards; that is structurally required, because retrieval RPCs join those
-- artifacts through a non-null source_chunk_id and an orphaned artifact
-- would be unreachable anyway. The guarded deletes for those three tables
-- protect only rows with source_chunk_id IS NULL.
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

  -- M13: superseded-generation rows always go; legacy NULL-generation rows go
  -- only when this generation wrote replacement rows into the same table.
  delete from public.document_chunks
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and exists (
          select 1
          from public.document_chunks replacement
          where replacement.document_id = p_document_id
            and replacement.index_generation_id = p_index_generation_id
        )
      )
    );

  delete from public.document_images
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_images replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_table_facts
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_table_facts replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_embedding_fields
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_embedding_fields replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_index_units
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_index_units replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_memory_cards
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_memory_cards replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_sections
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_sections replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  return jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'index_generation_id', p_index_generation_id
  );
end;
$$;

revoke execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) to service_role;

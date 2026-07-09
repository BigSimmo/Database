-- R5: deep-merge documents.metadata on worker/commit writes.
--
-- Root cause: commit_document_index_generation and worker updateDocument paths
-- full-replaced documents.metadata, erasing concurrent renames / bulk-metadata
-- / agent-state patches under reclaim races (docs/ingestion-concurrency-fix-workorder.md).
--
-- Expand/contract: new helpers are additive; commit RPC keeps the same signature
-- and only changes the metadata assignment from replace to deep-merge. Safe to
-- apply before the worker deploy. Old workers that still send a full object still
-- benefit because merge preserves keys absent from the patch; the paired worker
-- change sends worker-owned key deltas only.

create or replace function public.jsonb_merge_deep(target_obj jsonb, patch_obj jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  merged jsonb := coalesce(target_obj, '{}'::jsonb);
  key text;
  incoming_value jsonb;
begin
  for key, incoming_value in
    select j.key, j.value
    from jsonb_each(coalesce(patch_obj, '{}'::jsonb)) as j
  loop
    -- JSON null means "delete this key" so worker deltas can clear sticky
    -- error/gate fields that the old full-replace used to wipe implicitly.
    if incoming_value = 'null'::jsonb then
      merged := merged - key;
    elsif jsonb_typeof(merged -> key) = 'object' and jsonb_typeof(incoming_value) = 'object' then
      merged := jsonb_set(
        merged,
        array[key],
        public.jsonb_merge_deep(merged -> key, incoming_value),
        true
      );
    else
      merged := jsonb_set(merged, array[key], incoming_value, true);
    end if;
  end loop;
  return merged;
end;
$$;

create or replace function public.apply_document_metadata_patch(
  p_document_id uuid,
  p_metadata_patch jsonb
)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  update public.documents
  set
    metadata = public.jsonb_merge_deep(
      coalesce(metadata, '{}'::jsonb),
      coalesce(p_metadata_patch, '{}'::jsonb)
    ),
    updated_at = now()
  where id = p_document_id;
end;
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
    updated_at = now()
  where id = p_document_id;

  -- R5: merge worker-owned keys onto live metadata instead of full-replace.
  perform public.apply_document_metadata_patch(
    p_document_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', p_index_generation_id)
  );

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

  -- Preserve legacy NULL-generation rows unless this generation wrote replacements.
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

  -- artifact tables: use typed column where set; fall back to metadata when typed is NULL
  -- because the writer still populates metadata.index_generation_id rather than the typed
  -- column.  Without the metadata fallback, stale null-typed rows from a prior run would
  -- never be cleaned up (the typed-column EXISTS guard would always be false), allowing
  -- artifact rows to accumulate across re-indexes.
  delete from public.document_images
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_images replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_table_facts
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_table_facts replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_embedding_fields
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_embedding_fields replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_index_units
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_index_units replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_memory_cards
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_memory_cards replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_sections
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_sections replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
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

revoke execute on function public.jsonb_merge_deep(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.jsonb_merge_deep(jsonb, jsonb) to service_role;
revoke execute on function public.apply_document_metadata_patch(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_document_metadata_patch(uuid, jsonb) to service_role;
revoke execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) to service_role;

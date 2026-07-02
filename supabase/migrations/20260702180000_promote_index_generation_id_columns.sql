-- Fix #4: Promote index_generation_id from JSONB metadata to typed UUID columns
-- in the 6 artifact tables that lag behind document_chunks.
--
-- document_chunks already carries a typed index_generation_id uuid column, allowing
-- fast index-only scans during commit and cleanup. The other 6 artifact tables
-- (document_images, document_table_facts, document_embedding_fields,
--  document_index_units, document_memory_cards, document_sections) still fish the
-- value out of a JSONB blob, forcing a full table scan for commit/cleanup DELETEs.
--
-- What this migration does:
--   1. ADD COLUMN index_generation_id uuid to each of the 6 tables
--   2. Backfill from metadata->>'index_generation_id'
--   3. Add partial indexes (document_id, index_generation_id) WHERE index_generation_id IS NOT NULL
--   4. Add an overloaded is_committed_artifact_generation(uuid, jsonb) helper
--      matching the existing is_committed_document_generation(uuid, jsonb) pattern
--   5. Rewrite commit_document_index_generation DELETEs to use the typed column
--   6. Rewrite cleanup_abandoned_document_index_generations to use the typed column
--
-- BACKWARD COMPATIBILITY: The original JSONB-based
--   is_committed_artifact_generation(jsonb, jsonb) overload is preserved.
--   Query functions that call it continue to work unchanged. They can be
--   migrated to the new (uuid, jsonb) overload in a follow-up migration.

-- -------------------------------------------------------------------------
-- Step 1: Add typed columns
-- -------------------------------------------------------------------------

alter table public.document_images
  add column if not exists index_generation_id uuid;

alter table public.document_table_facts
  add column if not exists index_generation_id uuid;

alter table public.document_embedding_fields
  add column if not exists index_generation_id uuid;

alter table public.document_index_units
  add column if not exists index_generation_id uuid;

alter table public.document_memory_cards
  add column if not exists index_generation_id uuid;

alter table public.document_sections
  add column if not exists index_generation_id uuid;

-- -------------------------------------------------------------------------
-- Step 2: Backfill from existing JSONB metadata (NULL-safe cast)
-- -------------------------------------------------------------------------

update public.document_images
set index_generation_id = (metadata->>'index_generation_id')::uuid
where index_generation_id is null
  and nullif(metadata->>'index_generation_id', '') is not null;

update public.document_table_facts
set index_generation_id = (metadata->>'index_generation_id')::uuid
where index_generation_id is null
  and nullif(metadata->>'index_generation_id', '') is not null;

update public.document_embedding_fields
set index_generation_id = (metadata->>'index_generation_id')::uuid
where index_generation_id is null
  and nullif(metadata->>'index_generation_id', '') is not null;

update public.document_index_units
set index_generation_id = (metadata->>'index_generation_id')::uuid
where index_generation_id is null
  and nullif(metadata->>'index_generation_id', '') is not null;

update public.document_memory_cards
set index_generation_id = (metadata->>'index_generation_id')::uuid
where index_generation_id is null
  and nullif(metadata->>'index_generation_id', '') is not null;

update public.document_sections
set index_generation_id = (metadata->>'index_generation_id')::uuid
where index_generation_id is null
  and nullif(metadata->>'index_generation_id', '') is not null;

-- -------------------------------------------------------------------------
-- Step 3: Partial indexes on (document_id, index_generation_id)
--         WHERE index_generation_id IS NOT NULL
--         Mirrors document_chunks_document_generation_chunk_idx pattern.
-- -------------------------------------------------------------------------

create index if not exists document_images_document_generation_idx
  on public.document_images(document_id, index_generation_id)
  where index_generation_id is not null;

create index if not exists document_table_facts_document_generation_idx
  on public.document_table_facts(document_id, index_generation_id)
  where index_generation_id is not null;

create index if not exists document_embedding_fields_document_generation_idx
  on public.document_embedding_fields(document_id, index_generation_id)
  where index_generation_id is not null;

create index if not exists document_index_units_document_generation_idx
  on public.document_index_units(document_id, index_generation_id)
  where index_generation_id is not null;

create index if not exists document_memory_cards_document_generation_idx
  on public.document_memory_cards(document_id, index_generation_id)
  where index_generation_id is not null;

create index if not exists document_sections_document_generation_idx
  on public.document_sections(document_id, index_generation_id)
  where index_generation_id is not null;

-- -------------------------------------------------------------------------
-- Step 4: New overload is_committed_artifact_generation(uuid, jsonb)
--         Mirrors is_committed_document_generation(uuid, jsonb).
--         Returns true if artifact_generation_id is null (uncommitted/legacy)
--         OR if it matches the document's committed generation.
-- -------------------------------------------------------------------------

create or replace function public.is_committed_artifact_generation(
  artifact_generation_id uuid,
  document_metadata jsonb
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select artifact_generation_id is null
    or artifact_generation_id::text =
       nullif(coalesce(document_metadata, '{}'::jsonb)->>'index_generation_id', '');
$$;

revoke execute on function public.is_committed_artifact_generation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.is_committed_artifact_generation(uuid, jsonb) to service_role;

-- -------------------------------------------------------------------------
-- Step 5: Update commit_document_index_generation to use typed columns
-- -------------------------------------------------------------------------

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

  -- document_chunks: typed column (unchanged)
  delete from public.document_chunks
  where document_id = p_document_id
    and (index_generation_id is null or index_generation_id <> p_index_generation_id);

  -- artifact tables: now use typed index_generation_id column
  delete from public.document_images
  where document_id = p_document_id
    and (index_generation_id is null or index_generation_id <> p_index_generation_id);

  delete from public.document_table_facts
  where document_id = p_document_id
    and (index_generation_id is null or index_generation_id <> p_index_generation_id);

  delete from public.document_embedding_fields
  where document_id = p_document_id
    and (index_generation_id is null or index_generation_id <> p_index_generation_id);

  delete from public.document_index_units
  where document_id = p_document_id
    and (index_generation_id is null or index_generation_id <> p_index_generation_id);

  delete from public.document_memory_cards
  where document_id = p_document_id
    and (index_generation_id is null or index_generation_id <> p_index_generation_id);

  delete from public.document_sections
  where document_id = p_document_id
    and (index_generation_id is null or index_generation_id <> p_index_generation_id);

  return jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'index_generation_id', p_index_generation_id
  );
end;
$$;

revoke execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) to service_role;

-- -------------------------------------------------------------------------
-- Step 6: Update cleanup_abandoned_document_index_generations
-- -------------------------------------------------------------------------

create or replace function public.cleanup_abandoned_document_index_generations(
  p_document_id uuid default null,
  p_limit integer default 100,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  target_document_ids uuid[] := '{}'::uuid[];
  chunk_count integer := 0;
  image_count integer := 0;
  table_fact_count integer := 0;
  embedding_field_count integer := 0;
  index_unit_count integer := 0;
  memory_card_count integer := 0;
  section_count integer := 0;
begin
  perform set_config('statement_timeout', '180000', true);

  -- Collect distinct document_ids that have stale (non-committed) artifact rows.
  -- document_chunks uses its typed column; artifact tables use their new typed columns.
  with candidate_documents as (
    select distinct document_id
    from (
      -- document_chunks (typed index_generation_id)
      select c.document_id
      from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where (p_document_id is null or c.document_id = p_document_id)
        and c.index_generation_id is not null
        and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = c.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_images (typed index_generation_id)
      select a.document_id
      from public.document_images a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_table_facts (typed index_generation_id)
      select a.document_id
      from public.document_table_facts a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_embedding_fields (typed index_generation_id)
      select a.document_id
      from public.document_embedding_fields a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_index_units (typed index_generation_id)
      select a.document_id
      from public.document_index_units a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_memory_cards (typed index_generation_id)
      select a.document_id
      from public.document_memory_cards a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_sections (typed index_generation_id)
      select a.document_id
      from public.document_sections a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
    ) candidates
    limit least(greatest(coalesce(p_limit, 100), 1), 1000)
  )
  select coalesce(array_agg(document_id), '{}'::uuid[])
  into target_document_ids
  from candidate_documents;

  -- Count stale rows (typed column comparisons)
  select count(*) into chunk_count
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.document_id = any(target_document_ids)
    and c.index_generation_id is not null
    and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into image_count
  from public.document_images a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into table_fact_count
  from public.document_table_facts a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into embedding_field_count
  from public.document_embedding_fields a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into index_unit_count
  from public.document_index_units a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into memory_card_count
  from public.document_memory_cards a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into section_count
  from public.document_sections a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  if not coalesce(p_dry_run, true) then
    delete from public.document_chunks c
    using public.documents d
    where d.id = c.document_id
      and c.document_id = any(target_document_ids)
      and c.index_generation_id is not null
      and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_images a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_table_facts a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_embedding_fields a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_index_units a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_memory_cards a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_sections a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');
  end if;

  return jsonb_build_object(
    'ok', true,
    'dry_run', coalesce(p_dry_run, true),
    'document_count', coalesce(array_length(target_document_ids, 1), 0),
    'document_ids', to_jsonb(target_document_ids),
    'counts', jsonb_build_object(
      'document_chunks', chunk_count,
      'document_images', image_count,
      'document_table_facts', table_fact_count,
      'document_embedding_fields', embedding_field_count,
      'document_index_units', index_unit_count,
      'document_memory_cards', memory_card_count,
      'document_sections', section_count
    )
  );
end;
$$;

revoke execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) to service_role;

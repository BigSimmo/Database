-- Forward reconciliation for remediation functions whose original migration
-- versions were recorded before their canonical definitions reached main.
-- Re-applying CREATE OR REPLACE is additive and preserves the reviewed ACLs.

create or replace function public.commit_document_deep_memory_generation(
  p_document_id uuid,
  p_producer text,
  p_artifact_generation_id uuid,
  p_rag_memory_version text,
  p_document_intelligence_version text,
  p_section_count integer,
  p_memory_card_count integer,
  p_index_unit_counts_by_type jsonb,
  p_repaired_anchor_count integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_document_metadata jsonb;
  v_document_owner_id uuid;
  v_committed_index_generation uuid;
  v_total_section_count integer;
  v_total_memory_card_count integer;
  v_total_index_unit_count integer;
  v_section_count integer;
  v_memory_card_count integer;
  v_index_unit_count integer;
  v_expected_index_unit_count integer;
  v_index_unit_counts_by_type jsonb;
begin
  if nullif(btrim(p_producer), '') is null
    or nullif(btrim(p_rag_memory_version), '') is null
    or nullif(btrim(p_document_intelligence_version), '') is null
  then
    raise exception 'Deep-memory producer must be non-empty.' using errcode = '22023';
  end if;
  if p_artifact_generation_id is null then
    raise exception 'Deep-memory artifact generation must be set.' using errcode = '22023';
  end if;
  if p_section_count is null or p_memory_card_count is null or p_repaired_anchor_count is null
    or p_section_count < 0 or p_memory_card_count < 0 or p_repaired_anchor_count < 0
  then
    raise exception 'Deep-memory counts cannot be negative.' using errcode = '22023';
  end if;
  if p_index_unit_counts_by_type is null or jsonb_typeof(p_index_unit_counts_by_type) <> 'object' then
    raise exception 'Deep-memory index-unit counts must be an object.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_each(p_index_unit_counts_by_type) item
    where jsonb_typeof(item.value) <> 'number'
      or (item.value #>> '{}')::numeric < 0
      or trunc((item.value #>> '{}')::numeric) <> (item.value #>> '{}')::numeric
      or (item.value #>> '{}')::numeric > 2147483647
  ) then
    raise exception 'Deep-memory index-unit counts must be nonnegative integers.' using errcode = '22023';
  end if;

  select coalesce(d.metadata, '{}'::jsonb), d.owner_id
  into v_document_metadata, v_document_owner_id
  from public.documents d
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'Document % does not exist.', p_document_id using errcode = 'P0002';
  end if;

  begin
    v_committed_index_generation := nullif(v_document_metadata->>'index_generation_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Document % has an invalid committed index generation.', p_document_id using errcode = '22023';
  end;
  if v_committed_index_generation is null then
    raise exception 'Document % has no committed index generation.', p_document_id using errcode = '23514';
  end if;
  if v_committed_index_generation = p_artifact_generation_id then
    raise exception 'Staged deep-memory generation must differ from the committed index generation.' using errcode = '23514';
  end if;

  -- A generation UUID is a single-producer staging boundary. Reject collisions
  -- rather than interpreting another producer's rows as part of this commit.
  if exists (
    select 1 from public.document_sections
    where document_id = p_document_id
      and artifact_generation_id = p_artifact_generation_id
      and producer is distinct from p_producer
  ) or exists (
    select 1 from public.document_memory_cards
    where document_id = p_document_id
      and artifact_generation_id = p_artifact_generation_id
      and producer is distinct from p_producer
  ) or exists (
    select 1 from public.document_index_units
    where document_id = p_document_id
      and artifact_generation_id = p_artifact_generation_id
      and producer is distinct from p_producer
  ) then
    raise exception 'Deep-memory artifact generation belongs to another producer.' using errcode = '23514';
  end if;

  -- Re-check producer evidence inside the transaction. The application
  -- preflight is advisory only; rows can change between preflight and commit.
  -- The version-only section form is the one legacy local-worker shape already
  -- recognised by the containment layer. It is migration-owned, not supplied
  -- by the caller, and remains eligible only for local-worker.
  if exists (
    select 1 from public.document_sections
    where document_id = p_document_id
      and (
        (producer is not null and nullif(metadata->>'generated_by', '') is distinct from producer)
        or (producer is null and nullif(metadata->>'generated_by', '') is not null and metadata->>'generated_by' <> p_producer)
        or (producer is null and artifact_generation_id is not null)
        or (
          producer is null
          and nullif(metadata->>'generated_by', '') is null
          and not (
            p_producer = 'local-worker'
            and artifact_generation_id is null
            and metadata->>'rag_indexing_version' = 'rag-deep-memory-v1'
          )
        )
      )
  ) or exists (
    select 1 from public.document_memory_cards
    where document_id = p_document_id
      and (
        (producer is not null and nullif(metadata->>'generated_by', '') is distinct from producer)
        or (producer is null and nullif(metadata->>'generated_by', '') is not null and metadata->>'generated_by' <> p_producer)
        or (producer is null and artifact_generation_id is not null)
        or (
          producer is null
          and nullif(metadata->>'generated_by', '') is null
          and not (p_producer = 'local-worker' and artifact_generation_id is null)
        )
      )
  ) or exists (
    select 1 from public.document_index_units
    where document_id = p_document_id
      and (
        (producer is not null and nullif(metadata->>'generated_by', '') is distinct from producer)
        or (producer is null and nullif(metadata->>'generated_by', '') is not null and metadata->>'generated_by' <> p_producer)
        or (producer is null and artifact_generation_id is not null)
        or (
          producer is null
          and nullif(metadata->>'generated_by', '') is null
          and not (p_producer = 'local-worker' and artifact_generation_id is null)
        )
      )
  ) then
    raise exception 'Deep-memory artifact producer evidence is contradictory or ambiguous.' using errcode = '23514';
  end if;

  select count(*) into v_total_section_count
  from public.document_sections
  where document_id = p_document_id
    and artifact_generation_id = p_artifact_generation_id;

  select count(*) into v_total_memory_card_count
  from public.document_memory_cards
  where document_id = p_document_id
    and artifact_generation_id = p_artifact_generation_id;

  select count(*) into v_total_index_unit_count
  from public.document_index_units
  where document_id = p_document_id
    and artifact_generation_id = p_artifact_generation_id;

  select count(*) into v_section_count
  from public.document_sections
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id
    and index_generation_id = p_artifact_generation_id
    and owner_id is not distinct from v_document_owner_id
    and metadata->>'generated_by' = p_producer
    and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
    and metadata->>'index_generation_id' = p_artifact_generation_id::text;

  select count(*) into v_memory_card_count
  from public.document_memory_cards
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id
    and index_generation_id = p_artifact_generation_id
    and owner_id is not distinct from v_document_owner_id
    and metadata->>'generated_by' = p_producer
    and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
    and metadata->>'index_generation_id' = p_artifact_generation_id::text;

  select coalesce(sum(unit_count), 0)::integer, coalesce(jsonb_object_agg(unit_type, unit_count), '{}'::jsonb)
  into v_index_unit_count, v_index_unit_counts_by_type
  from (
    select unit_type, count(*)::integer as unit_count
    from public.document_index_units
    where document_id = p_document_id
      and producer = p_producer
      and artifact_generation_id = p_artifact_generation_id
      and index_generation_id = p_artifact_generation_id
      and owner_id is not distinct from v_document_owner_id
      and metadata->>'generated_by' = p_producer
      and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
      and metadata->>'index_generation_id' = p_artifact_generation_id::text
    group by unit_type
  ) staged_index_units;

  select coalesce(sum(value::integer), 0)
  into v_expected_index_unit_count
  from jsonb_each_text(coalesce(p_index_unit_counts_by_type, '{}'::jsonb));

  if v_total_section_count <> v_section_count
    or v_total_memory_card_count <> v_memory_card_count
    or v_total_index_unit_count <> coalesce(v_index_unit_count, 0)
    or v_section_count <> p_section_count
    or v_memory_card_count <> p_memory_card_count
    or coalesce(v_index_unit_count, 0) <> v_expected_index_unit_count
    or v_index_unit_counts_by_type <> coalesce(p_index_unit_counts_by_type, '{}'::jsonb)
  then
    raise exception 'Staged deep-memory artifact counts do not match the commit contract.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.document_memory_cards card
    left join public.document_sections section
      on section.id = card.section_id
      and section.document_id = p_document_id
      and section.producer = p_producer
      and section.artifact_generation_id = p_artifact_generation_id
    where card.document_id = p_document_id
      and card.producer = p_producer
      and card.artifact_generation_id = p_artifact_generation_id
      and card.section_id is not null
      and section.id is null
  ) then
    raise exception 'Staged memory cards reference a section outside the staged generation.' using errcode = '23514';
  end if;

  -- Refuse to null another producer's section reference through ON DELETE SET
  -- NULL. This keeps the "other producers untouched" guarantee literal.
  if exists (
    select 1
    from public.document_memory_cards card
    join public.document_sections section on section.id = card.section_id
    where section.document_id = p_document_id
      and section.artifact_generation_id is distinct from p_artifact_generation_id
      and (
        section.producer = p_producer
        or (
          section.producer is null
          and (
            section.metadata->>'generated_by' = p_producer
            or (
              p_producer = 'local-worker'
              and nullif(section.metadata->>'generated_by', '') is null
              and section.metadata->>'rag_indexing_version' = 'rag-deep-memory-v1'
            )
          )
        )
      )
      and not (
        (card.producer = p_producer and card.metadata->>'generated_by' = p_producer)
        or (card.producer is null and card.metadata->>'generated_by' = p_producer)
        or (
          p_producer = 'local-worker'
          and card.producer is null
          and card.artifact_generation_id is null
          and nullif(card.metadata->>'generated_by', '') is null
        )
      )
  ) then
    raise exception 'Another producer references an older section owned by this producer.' using errcode = '23514';
  end if;

  update public.document_sections
  set
    index_generation_id = v_committed_index_generation,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'generated_by', p_producer,
      'artifact_generation_id', p_artifact_generation_id,
      'index_generation_id', v_committed_index_generation
    ),
    updated_at = now()
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id
    and index_generation_id = p_artifact_generation_id
    and owner_id is not distinct from v_document_owner_id
    and metadata->>'generated_by' = p_producer
    and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
    and metadata->>'index_generation_id' = p_artifact_generation_id::text;

  update public.document_memory_cards
  set
    index_generation_id = v_committed_index_generation,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'generated_by', p_producer,
      'artifact_generation_id', p_artifact_generation_id,
      'index_generation_id', v_committed_index_generation
    ),
    updated_at = now()
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id
    and index_generation_id = p_artifact_generation_id
    and owner_id is not distinct from v_document_owner_id
    and metadata->>'generated_by' = p_producer
    and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
    and metadata->>'index_generation_id' = p_artifact_generation_id::text;

  update public.document_index_units
  set
    index_generation_id = v_committed_index_generation,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'generated_by', p_producer,
      'artifact_generation_id', p_artifact_generation_id,
      'index_generation_id', v_committed_index_generation
    ),
    updated_at = now()
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id
    and index_generation_id = p_artifact_generation_id
    and owner_id is not distinct from v_document_owner_id
    and metadata->>'generated_by' = p_producer
    and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
    and metadata->>'index_generation_id' = p_artifact_generation_id::text;

  delete from public.document_memory_cards
  where document_id = p_document_id
    and artifact_generation_id is distinct from p_artifact_generation_id
    and (
      (producer = p_producer and metadata->>'generated_by' = p_producer)
      or (producer is null and metadata->>'generated_by' = p_producer)
      or (
        p_producer = 'local-worker'
        and producer is null
        and artifact_generation_id is null
        and nullif(metadata->>'generated_by', '') is null
      )
    );

  delete from public.document_index_units
  where document_id = p_document_id
    and artifact_generation_id is distinct from p_artifact_generation_id
    and (
      (producer = p_producer and metadata->>'generated_by' = p_producer)
      or (producer is null and metadata->>'generated_by' = p_producer)
      or (
        p_producer = 'local-worker'
        and producer is null
        and artifact_generation_id is null
        and nullif(metadata->>'generated_by', '') is null
      )
    );

  delete from public.document_sections
  where document_id = p_document_id
    and artifact_generation_id is distinct from p_artifact_generation_id
    and (
      (producer = p_producer and metadata->>'generated_by' = p_producer)
      or (
        producer is null
        and (
          metadata->>'generated_by' = p_producer
          or (
            p_producer = 'local-worker'
            and nullif(metadata->>'generated_by', '') is null
            and metadata->>'rag_indexing_version' = 'rag-deep-memory-v1'
          )
        )
      )
    );

  -- This is deliberately the final logical mutation. Any error above rolls
  -- back both activation and producer-scoped cleanup before metadata advertises
  -- the new deep-memory generation.
  perform public.apply_document_metadata_patch(
    p_document_id,
    jsonb_build_object(
      'rag_indexing_version', p_rag_memory_version,
      'rag_memory_version', p_rag_memory_version,
      'rag_memory_updated_at', now(),
      'document_intelligence_version', p_document_intelligence_version,
      'document_intelligence_updated_at', now(),
      'section_count', p_section_count,
      'memory_card_count', p_memory_card_count,
      'index_unit_count', v_expected_index_unit_count,
      'index_unit_counts_by_type', coalesce(p_index_unit_counts_by_type, '{}'::jsonb),
      'repaired_anchor_count', p_repaired_anchor_count,
      'deep_memory_generations', jsonb_build_object(p_producer, p_artifact_generation_id)
    )
  );

  return jsonb_build_object(
    'document_id', p_document_id,
    'producer', p_producer,
    'artifact_generation_id', p_artifact_generation_id,
    'index_generation_id', v_committed_index_generation,
    'section_count', p_section_count,
    'memory_card_count', p_memory_card_count,
    'index_unit_count', v_expected_index_unit_count
  );
end;
$$;

revoke execute on function public.commit_document_deep_memory_generation(uuid, text, uuid, text, text, integer, integer, jsonb, integer) from public, anon, authenticated;
grant execute on function public.commit_document_deep_memory_generation(uuid, text, uuid, text, text, integer, integer, jsonb, integer) to service_role;

create or replace function public.request_indexing_v3_enrichment(
  p_document_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job_id uuid;
  v_job_status text;
begin
  -- Validate without taking the document lock. The job row is created/locked
  -- first below so request and claim paths share one lock order.
  perform 1
  from public.documents
  where id = p_document_id and owner_id = p_owner_id and status = 'indexed';
  if not found then
    raise exception using errcode = 'P0001', message = 'document_not_available_for_enrichment';
  end if;

  insert into public.indexing_v3_agent_jobs (
    document_id, status, enrichment_status, attempt_count, max_attempts, version, metadata
  ) values (
    p_document_id, 'pending', 'pending', 0, 3, 'visual-core-v3', '{}'::jsonb
  )
  on conflict (document_id) do nothing
  returning id, status into v_job_id, v_job_status;

  if v_job_id is null then
    select id, status into v_job_id, v_job_status
    from public.indexing_v3_agent_jobs
    where document_id = p_document_id
    for update;
  end if;

  if v_job_id is null then
    raise exception using errcode = 'P0001', message = 'enrichment_job_unavailable';
  end if;
  if v_job_status = 'processing' then
    raise exception using errcode = 'P0001', message = 'enrichment_active';
  end if;

  perform 1
  from public.documents
  where id = p_document_id and owner_id = p_owner_id and status = 'indexed'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'document_not_available_for_enrichment';
  end if;

  if exists (
    select 1 from public.ingestion_jobs
    where document_id = p_document_id and status in ('pending', 'processing')
  ) then
    raise exception using errcode = 'P0001', message = 'ingestion_active';
  end if;

  update public.indexing_v3_agent_jobs
  set status = 'pending',
      enrichment_status = 'pending',
      attempt_count = 0,
      locked_by = null,
      locked_at = null,
      next_run_at = null,
      last_error = null,
      updated_at = now()
  where id = v_job_id;

  update public.documents
  set metadata = (coalesce(metadata, '{}'::jsonb)
      - 'indexing_v3_agent_locked_by' - 'indexing_v3_agent_locked_at'
      - 'indexing_v3_agent_last_error' - 'indexing_v3_agent_next_run_at'
      - 'indexing_v3_agent_attempt_count' - 'indexing_v3_agent_max_attempts')
      || jsonb_build_object(
        'enrichment_status', 'pending',
        'indexing_v3_agent_status', 'pending',
        'indexing_v3_agent_updated_at', now()
      ),
      updated_at = now()
  where id = p_document_id and owner_id = p_owner_id;

  return jsonb_build_object('ok', true, 'job_id', v_job_id);
end;
$$;

revoke execute on function public.request_indexing_v3_enrichment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_indexing_v3_enrichment(uuid, uuid) to service_role;

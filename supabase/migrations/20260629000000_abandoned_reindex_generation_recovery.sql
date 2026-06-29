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

  with candidate_documents as (
    select distinct document_id
    from (
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
      select a.document_id
      from public.document_images a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_table_facts a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_embedding_fields a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_index_units a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_memory_cards a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_sections a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
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
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into table_fact_count
  from public.document_table_facts a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into embedding_field_count
  from public.document_embedding_fields a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into index_unit_count
  from public.document_index_units a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into memory_card_count
  from public.document_memory_cards a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into section_count
  from public.document_sections a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

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
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_table_facts a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_embedding_fields a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_index_units a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_memory_cards a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_sections a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');
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

create or replace function public.backfill_legacy_index_health_batch(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions', 'pg_temp'
as $$
declare
  repaired_count integer;
begin
  drop table if exists pg_temp.legacy_generation_repair;
  create temporary table legacy_generation_repair on commit drop as
  select candidate.document_id, gen_random_uuid() as generation_id
  from (
    select distinct ch.document_id
    from public.document_chunks ch
    join public.documents d on d.id = ch.document_id
    where d.status = 'indexed'
      and ch.index_generation_id is null
    order by ch.document_id
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) candidate;

  select count(*) into repaired_count from legacy_generation_repair;
  if repaired_count = 0 then
    return jsonb_build_object('repaired_documents', 0);
  end if;

  insert into public.document_labels (
    document_id, owner_id, label, label_type, source, confidence, metadata
  )
  select d.id, d.owner_id,
         lower(coalesce(nullif(trim(d.file_type), ''), 'document')),
         'document_type', 'generated', 0.70,
         jsonb_build_object('repair_source', 'db_repair', 'anchored', true, 'from', 'documents.file_type')
  from public.documents d
  join legacy_generation_repair repair on repair.document_id = d.id
  where not exists (
    select 1 from public.document_labels l
    where l.document_id = d.id and l.source = 'generated'
  )
  on conflict (document_id, label_type, label, source) do nothing;

  update public.document_chunks row
  set index_generation_id = repair.generation_id,
      metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.document_images row
  set index_generation_id = repair.generation_id,
      metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.document_table_facts row
  set index_generation_id = repair.generation_id,
      metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.document_embedding_fields row
  set index_generation_id = repair.generation_id,
      metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.document_index_units row
  set index_generation_id = repair.generation_id,
      metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.document_memory_cards row
  set index_generation_id = repair.generation_id,
      metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.document_sections row
  set index_generation_id = repair.generation_id,
      metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.document_summaries row
  set metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.document_labels row
  set metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id)
  from legacy_generation_repair repair where row.document_id = repair.document_id;

  update public.documents row
  set metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id),
      updated_at = now()
  from legacy_generation_repair repair where row.id = repair.document_id;

  return jsonb_build_object('repaired_documents', repaired_count);
end;
$$;

revoke all on function public.backfill_legacy_index_health_batch(integer) from public, anon, authenticated;
grant execute on function public.backfill_legacy_index_health_batch(integer) to service_role;

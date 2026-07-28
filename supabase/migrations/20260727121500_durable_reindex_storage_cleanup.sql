-- Audit remediation: keep storage cleanup durable across upload crashes and
-- image-bearing reindexes. The existing commit RPC remains available for one
-- mixed-version compatibility window; only the current worker moves to v2.

create or replace function public.commit_document_index_generation_v2(
  p_job_id uuid,
  p_worker_id text,
  p_document_id uuid,
  p_index_generation_id uuid,
  p_image_bucket text,
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
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job public.ingestion_jobs%rowtype;
  v_owner_id uuid;
  v_prior_generation_id text;
  v_obsolete_image_paths text[] := '{}'::text[];
  v_cleanup_job_id uuid;
  v_result jsonb;
begin
  if nullif(btrim(p_image_bucket), '') is null then
    raise exception 'Image bucket must be non-empty.' using errcode = '22023';
  end if;

  select * into v_job
  from public.ingestion_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.document_id is distinct from p_document_id
    or v_job.status is distinct from 'processing'
    or v_job.locked_by is distinct from p_worker_id
  then
    raise exception using errcode = 'P0001', message = 'ingestion_lease_lost';
  end if;

  select owner_id, metadata->>'index_generation_id'
  into v_owner_id, v_prior_generation_id
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'document_not_found';
  end if;

  -- This predicate intentionally matches the current generation commit's
  -- document_images DELETE exactly. Snapshot paths before that DELETE runs.
  select coalesce(
    array_agg(distinct storage_path order by storage_path)
      filter (where storage_path is not null and btrim(storage_path) <> ''),
    '{}'::text[]
  )
  into v_obsolete_image_paths
  from public.document_images
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
              or (
                replacement.index_generation_id is null
                and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id
              )
            )
        )
      )
    );

  if cardinality(v_obsolete_image_paths) > 0 then
    insert into public.storage_cleanup_jobs (
      owner_id,
      document_id,
      document_bucket,
      document_paths,
      image_bucket,
      image_paths,
      status,
      metadata
    )
    values (
      v_owner_id,
      p_document_id,
      'clinical-documents',
      '{}'::text[],
      p_image_bucket,
      v_obsolete_image_paths,
      'pending',
      jsonb_strip_nulls(jsonb_build_object(
        'operation', 'obsolete_index_generation',
        'job_id', p_job_id,
        'prior_index_generation_id', v_prior_generation_id,
        'committed_index_generation_id', p_index_generation_id
      ))
    )
    returning id into v_cleanup_job_id;
  end if;

  v_result := public.commit_document_index_generation(
    p_document_id,
    p_index_generation_id,
    p_status,
    p_page_count,
    p_chunk_count,
    p_image_count,
    p_metadata,
    p_pages,
    p_quality
  );

  return v_result || jsonb_build_object(
    'storage_cleanup_job_id', v_cleanup_job_id,
    'obsolete_image_path_count', cardinality(v_obsolete_image_paths)
  );
end;
$$;

revoke execute on function public.commit_document_index_generation_v2(
  uuid, text, uuid, uuid, text, text, integer, integer, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.commit_document_index_generation_v2(
  uuid, text, uuid, uuid, text, text, integer, integer, integer, jsonb, jsonb, jsonb
) to service_role;


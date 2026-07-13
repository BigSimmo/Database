-- Prevent a reclaimed ingestion worker from publishing an index generation.
-- Locking the job row keeps lease validation and the underlying commit atomic.

create or replace function public.commit_document_index_generation(
  p_job_id uuid,
  p_worker_id text,
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
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job public.ingestion_jobs%rowtype;
begin
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

  return public.commit_document_index_generation(
    p_document_id, p_index_generation_id, p_status, p_page_count, p_chunk_count,
    p_image_count, p_metadata, p_pages, p_quality
  );
end;
$$;

revoke execute on function public.commit_document_index_generation(
  uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke execute on function public.commit_document_index_generation(
  uuid, text, uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_document_index_generation(
  uuid, text, uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) to service_role;

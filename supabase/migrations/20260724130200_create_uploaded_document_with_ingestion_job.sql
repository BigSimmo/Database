-- Atomically create an uploaded document row and its initial ingestion job.
-- The upload route has already stored the object and validated owner/file metadata;
-- this RPC closes the process-crash window between `documents.insert` and
-- `ingestion_jobs.insert` by doing both database writes in one transaction.
create or replace function public.create_uploaded_document_with_ingestion_job(
  p_document jsonb,
  p_max_attempts integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_job public.ingestion_jobs%rowtype;
begin
  insert into public.documents (
    id,
    owner_id,
    title,
    description,
    file_name,
    file_type,
    file_size,
    storage_path,
    content_hash,
    status,
    metadata
  ) values (
    (p_document->>'id')::uuid,
    (p_document->>'owner_id')::uuid,
    p_document->>'title',
    nullif(p_document->>'description', ''),
    p_document->>'file_name',
    p_document->>'file_type',
    coalesce((p_document->>'file_size')::bigint, 0),
    p_document->>'storage_path',
    nullif(p_document->>'content_hash', ''),
    'queued',
    coalesce(p_document->'metadata', '{}'::jsonb)
  )
  returning * into v_document;

  insert into public.ingestion_jobs (
    document_id,
    batch_id,
    status,
    stage,
    progress,
    max_attempts
  ) values (
    v_document.id,
    null,
    'pending',
    'queued',
    0,
    p_max_attempts
  )
  returning * into v_job;

  return jsonb_build_object(
    'document', to_jsonb(v_document),
    'job', to_jsonb(v_job)
  );
end;
$$;

revoke execute on function public.create_uploaded_document_with_ingestion_job(jsonb, integer) from public, anon, authenticated;
grant execute on function public.create_uploaded_document_with_ingestion_job(jsonb, integer) to service_role;

-- Serialize permanent document deletion with ingestion job creation. The
-- parent row lock conflicts with the FK key-share lock taken by a concurrent
-- ingestion_jobs insert: either the job commits first and deletion returns an
-- active_job outcome, or deletion commits first and the insert receives 23503.
create or replace function public.delete_document_if_idle(
  p_document_id uuid,
  p_owner_id uuid,
  p_document_bucket text,
  p_image_bucket text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_active_job public.ingestion_jobs%rowtype;
  v_cleanup_job_id uuid;
  v_image_paths text[] := '{}'::text[];
  v_chunk_ids uuid[] := '{}'::uuid[];
begin
  if p_document_id is null or p_owner_id is null then
    raise exception 'Document and owner identifiers are required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_document_bucket), '') is null or nullif(btrim(p_image_bucket), '') is null then
    raise exception 'Storage bucket names are required.' using errcode = '22023';
  end if;

  select d.*
    into v_document
    from public.documents d
   where d.id = p_document_id
     and d.owner_id = p_owner_id
   for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select j.*
    into v_active_job
    from public.ingestion_jobs j
   where j.document_id = p_document_id
     and j.status in ('pending', 'processing')
   order by j.created_at asc, j.id asc
   limit 1;

  if found then
    return jsonb_build_object(
      'outcome', 'active_job',
      'job_id', v_active_job.id,
      'job_status', v_active_job.status
    );
  end if;

  select coalesce(array_agg(distinct i.storage_path order by i.storage_path)
                          filter (where i.storage_path is not null and btrim(i.storage_path) <> ''), '{}'::text[])
    into v_image_paths
    from public.document_images i
   where i.document_id = p_document_id;

  select coalesce(array_agg(c.id order by c.id), '{}'::uuid[])
    into v_chunk_ids
    from public.document_chunks c
   where c.document_id = p_document_id;

  insert into public.storage_cleanup_jobs (
    owner_id,
    document_id,
    document_title,
    document_bucket,
    document_paths,
    image_bucket,
    image_paths,
    status,
    metadata
  ) values (
    p_owner_id,
    p_document_id,
    v_document.title,
    p_document_bucket,
    case
      when v_document.storage_path is null or btrim(v_document.storage_path) = '' then '{}'::text[]
      else array[v_document.storage_path]
    end,
    p_image_bucket,
    v_image_paths,
    'pending',
    jsonb_build_object(
      'operation', 'permanent_document_delete',
      'created_by', 'delete_document_if_idle'
    )
  )
  returning id into v_cleanup_job_id;

  if cardinality(v_chunk_ids) > 0 then
    delete from public.rag_queries
     where source_chunk_ids && v_chunk_ids;
    delete from public.rag_query_misses
     where top_chunk_ids && v_chunk_ids
        or cited_chunk_ids && v_chunk_ids;
  end if;

  delete from public.rag_query_misses
   where clicked_document_id = p_document_id
      or expected_document_id = p_document_id;

  delete from public.rag_response_cache
   where owner_id = p_owner_id
     and cache_kind in ('search', 'answer');

  delete from public.documents where id = p_document_id;

  return jsonb_build_object(
    'outcome', 'deleted',
    'cleanup_job_id', v_cleanup_job_id,
    'document_title', v_document.title,
    'source_path', v_document.storage_path,
    'image_paths', to_jsonb(v_image_paths)
  );
end;
$$;

revoke all on function public.delete_document_if_idle(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.delete_document_if_idle(uuid, uuid, text, text)
  to service_role;

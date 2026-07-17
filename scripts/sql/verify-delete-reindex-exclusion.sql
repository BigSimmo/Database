begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values (
  'd1000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'delete-race-owner@example.test',
  '',
  now(),
  now()
);

insert into public.documents (id, owner_id, title, file_name, file_type, storage_path, status)
values (
  'd2000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000001',
  'Delete race fixture',
  'delete-race.pdf',
  'application/pdf',
  'delete-race/source.pdf',
  'indexed'
);

insert into public.document_images (document_id, storage_path)
values ('d2000000-0000-4000-8000-000000000002', 'delete-race/image-1.png');

insert into public.ingestion_jobs (id, document_id, status, stage, progress)
values (
  'd3000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000002',
  'pending',
  'queued',
  0
);

do $$
declare
  result jsonb;
begin
  result := public.delete_document_if_idle(
    'd2000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000001',
    'clinical-documents',
    'clinical-images'
  );
  if result->>'outcome' <> 'active_job' then
    raise exception 'job-first ordering did not block deletion: %', result;
  end if;
  if not exists (select 1 from public.documents where id = 'd2000000-0000-4000-8000-000000000002') then
    raise exception 'job-first ordering deleted the document';
  end if;
end;
$$;

delete from public.ingestion_jobs where id = 'd3000000-0000-4000-8000-000000000003';

do $$
declare
  result jsonb;
  cleanup_id uuid;
begin
  result := public.delete_document_if_idle(
    'd2000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000001',
    'clinical-documents',
    'clinical-images'
  );
  if result->>'outcome' <> 'deleted' then
    raise exception 'delete-first ordering did not delete: %', result;
  end if;
  cleanup_id := (result->>'cleanup_job_id')::uuid;
  if not exists (
    select 1 from public.storage_cleanup_jobs
     where id = cleanup_id
       and document_id is null
       and document_paths = array['delete-race/source.pdf']
       and image_paths = array['delete-race/image-1.png']
  ) then
    raise exception 'delete cleanup ledger did not preserve the storage snapshot';
  end if;

  begin
    insert into public.ingestion_jobs (document_id, status, stage, progress)
    values ('d2000000-0000-4000-8000-000000000002', 'pending', 'queued', 0);
    raise exception 'delete-first ordering allowed a reindex job';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

rollback;

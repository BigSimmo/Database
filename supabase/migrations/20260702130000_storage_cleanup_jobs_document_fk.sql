-- Fix #3: Add foreign key from storage_cleanup_jobs.document_id to documents(id).
--
-- The column was declared as "uuid" with no referential constraint, meaning
-- orphaned rows (pointing to deleted documents) would accumulate silently.
-- We first delete any orphaned rows, then add ON DELETE SET NULL so future
-- document deletions leave the cleanup job record in place (the worker should
-- still attempt storage cleanup for any paths recorded before deletion).

-- Step 1: remove orphans (document_id is non-null but no matching document exists).
delete from public.storage_cleanup_jobs
where document_id is not null
  and not exists (
    select 1 from public.documents d where d.id = storage_cleanup_jobs.document_id
  );

-- Step 2: add the FK constraint.
alter table public.storage_cleanup_jobs
  add constraint storage_cleanup_jobs_document_id_fkey
  foreign key (document_id)
  references public.documents(id)
  on delete set null;

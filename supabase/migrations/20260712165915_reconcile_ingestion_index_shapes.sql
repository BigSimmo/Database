set lock_timeout = '5s';

drop index if exists public.import_batches_status_created_idx;
create index import_batches_status_created_idx
  on public.import_batches (status, created_at desc)
  where status in ('queued', 'processing');

drop index if exists public.ingestion_jobs_document_status_idx;
create index ingestion_jobs_document_status_idx
  on public.ingestion_jobs (document_id, status, created_at);

drop index if exists public.ingestion_jobs_status_next_run_idx;
create index ingestion_jobs_status_next_run_idx
  on public.ingestion_jobs (status, next_run_at, created_at)
  where status in ('pending', 'processing', 'failed');

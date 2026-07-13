-- Codify the migration version already recorded on production. The functions
-- are worker-only and must not retain PostgreSQL's default PUBLIC EXECUTE.

set search_path = public, pg_catalog, pg_temp;

revoke execute on function public.complete_ingestion_job(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_ingestion_job(uuid, uuid, uuid, text, text)
  to service_role;

revoke execute on function public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamp with time zone, text)
  from public, anon, authenticated;
grant execute on function public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamp with time zone, text)
  to service_role;

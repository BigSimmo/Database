-- Reconcile ingestion RPC permissions (revoke execute from public)
-- Recent migration 20260708130000 dropped and recreated complete_ingestion_job and fail_or_retry_ingestion_job.
-- Since migrations run as supabase_admin on Supabase, the default privileges for role postgres
-- do not apply. We must explicitly revoke PUBLIC execution on these new signatures.

set search_path = public, pg_catalog, pg_temp;

revoke execute on function public.complete_ingestion_job(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_ingestion_job(uuid, uuid, uuid, text, text) to service_role;

revoke execute on function public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamp with time zone, text) from public, anon, authenticated;
grant execute on function public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamp with time zone, text) to service_role;

-- Retire public.invoke_ingestion_worker(integer) (GitHub issue #2956).
--
-- The ingestion-worker Edge Function this RPC POSTs to refuses every request
-- with 410 before touching the queue (supabase/functions/ingestion-worker/retirement.ts).
-- The container worker owns ingestion, so the RPC can only produce failed HTTP
-- calls while remaining a SECURITY DEFINER entry point that reads a Vault JWT.
--
-- Any pg_cron job that still calls it is unscheduled first, so no schedule is
-- left erroring against a missing function. The Vault secret cron_ingestion_jwt
-- is deliberately left in place: invoke_indexing_v3_agent uses it from
-- 20260926041100 onwards. The app.ingestion_worker_base_url database setting
-- is left as is (ALTER DATABASE is denied on hosted Supabase); nothing reads it.
--
-- Rollback: re-create the function and its grants from
-- 20260725000000_audit_security_remediation.sql, then re-add the cron schedule.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $retire_ingestion_worker$
declare
  job record;
begin
  if to_regclass('cron.job') is not null then
    for job in
      select jobid
      from cron.job
      where command ilike '%invoke_ingestion_worker%'
    loop
      perform cron.unschedule(job.jobid);
    end loop;
  end if;
end
$retire_ingestion_worker$;

drop function if exists public.invoke_ingestion_worker(integer);

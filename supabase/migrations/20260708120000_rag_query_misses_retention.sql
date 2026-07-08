-- PIA-4 (docs/privacy-impact-assessment.md): rag_query_misses stores the same
-- hash-redacted query + candidate aliases as rag_queries, but unlike rag_queries
-- (30d) and rag_retrieval_logs (90d) it had NO retention bound, so rows
-- accumulated indefinitely. Add a matching nightly purge (90 days — wider than
-- rag_queries to leave headroom for the miss-review workflow, still bounding
-- long-lived query telemetry). Query text is already hash-redacted at write time
-- via queryTextForStorage, so this bounds redacted telemetry, not raw PHI.
set search_path = public, pg_catalog, pg_temp;

create or replace function public.purge_expired_rag_query_misses(p_retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_deleted integer;
begin
  if p_retention_days < 1 then
    raise exception 'retention days must be positive';
  end if;
  delete from public.rag_query_misses where created_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_rag_query_misses(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_rag_query_misses(integer) to service_role;

comment on table public.rag_query_misses is
  'Unresolved/low-confidence query telemetry (hash-redacted query + candidate aliases).
   Rows older than 90 days are purged nightly by the pg_cron job
   "purge-rag-query-misses" (see purge_expired_rag_query_misses). Adjust the window
   by changing the interval in that job definition.';

-- Register the nightly purge when pg_cron is available. Preview/branch databases
-- may not ship pg_cron; install the function there but skip scheduling.
do $cron$
begin
  if to_regnamespace('cron') is null then
    return;
  end if;

  perform cron.unschedule(j.jobid)
  from cron.job j
  where j.jobname = 'purge-rag-query-misses';

  perform cron.schedule(
    'purge-rag-query-misses',
    '45 3 * * *',
    $job$select public.purge_expired_rag_query_misses(90);$job$
  );
end
$cron$;

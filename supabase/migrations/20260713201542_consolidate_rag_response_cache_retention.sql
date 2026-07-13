-- Two earlier migrations installed separate response-cache purge jobs. Keep
-- only the job that calls the bounded implementation so cleanup cannot turn a
-- large cache backlog into a single long-running delete.
set search_path = public, pg_catalog, pg_temp;

do $cron$
begin
  if to_regnamespace('cron') is null then
    return;
  end if;

  perform cron.unschedule(j.jobid)
  from cron.job j
  where j.jobname in ('purge-rag-response-cache', 'purge-expired-rag-response-cache');

  perform cron.schedule(
    'purge-rag-response-cache',
    '15 * * * *',
    $job$select public.purge_expired_rag_response_cache(1000);$job$
  );
end
$cron$;

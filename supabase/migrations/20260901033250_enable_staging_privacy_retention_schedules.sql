-- Enable and reconcile privacy-retention schedules in environments where
-- the historical retention migrations ran before pg_cron was available.
--
-- Rollback: unschedule only the four named jobs. Drop pg_cron only when
-- cron.job contains no unrelated jobs.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $privacy_retention$
declare
  job record;
begin
  if to_regprocedure('public.purge_expired_rag_queries(integer)') is null then
    raise exception 'Missing public.purge_expired_rag_queries(integer)';
  end if;
  if to_regprocedure('public.purge_expired_rag_query_misses(integer)') is null then
    raise exception 'Missing public.purge_expired_rag_query_misses(integer)';
  end if;
  if to_regprocedure('public.purge_expired_rag_response_cache(integer)') is null then
    raise exception 'Missing public.purge_expired_rag_response_cache(integer)';
  end if;
  if to_regclass('public.rag_retrieval_logs') is null then
    raise exception 'Missing public.rag_retrieval_logs';
  end if;

  for job in
    select jobid
    from cron.job
    where jobname in (
      'purge-expired-rag-queries',
      'purge-rag-retrieval-logs',
      'purge-rag-query-misses',
      'purge-rag-response-cache',
      'purge-expired-rag-response-cache'
    )
  loop
    perform cron.unschedule(job.jobid);
  end loop;

  perform cron.schedule(
    'purge-expired-rag-queries',
    '30 3 * * *',
    $job$select public.purge_expired_rag_queries(30);$job$
  );

  perform cron.schedule(
    'purge-rag-retrieval-logs',
    '0 3 * * *',
    $job$delete from public.rag_retrieval_logs where created_at < now() - interval '90 days';$job$
  );

  perform cron.schedule(
    'purge-rag-query-misses',
    '45 3 * * *',
    $job$select public.purge_expired_rag_query_misses(90);$job$
  );

  perform cron.schedule(
    'purge-rag-response-cache',
    '15 * * * *',
    $job$select public.purge_expired_rag_response_cache(1000);$job$
  );
end
$privacy_retention$;

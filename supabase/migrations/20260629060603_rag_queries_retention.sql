set search_path = public, pg_catalog, pg_temp;

-- rag_queries can retain raw clinical query text (PHI) when RAG_PERSIST_RAW_QUERY_TEXT
-- is enabled. Bound retention so logs do not accumulate indefinitely. Default 30 days.
create or replace function public.purge_expired_rag_queries(p_retention_days integer default 30)
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
  delete from public.rag_queries where created_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_rag_queries(integer) from public, anon, authenticated;

-- Daily purge at 03:30 UTC. Preview/branch databases may not ship pg_cron; skip
-- scheduling there while still installing the purge function.
do $cron$
begin
  if to_regnamespace('cron') is null then
    return;
  end if;

  perform cron.unschedule(j.jobid)
  from cron.job j
  where j.jobname = 'purge-expired-rag-queries';

  perform cron.schedule(
    'purge-expired-rag-queries',
    '30 3 * * *',
    $job$select public.purge_expired_rag_queries(30);$job$
  );
end
$cron$;

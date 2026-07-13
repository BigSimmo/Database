create or replace function public.purge_expired_rag_response_cache()
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.rag_response_cache where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_expired_rag_response_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_rag_response_cache() to service_role;

do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'purge-expired-rag-response-cache';
    perform cron.schedule(
      'purge-expired-rag-response-cache',
      '45 3 * * *',
      $job$select public.purge_expired_rag_response_cache();$job$
    );
  end if;
end;
$$;

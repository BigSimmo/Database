-- Keep the cron-triggered indexing-v3 Edge Function invoker callable only from
-- server-side roles. The live project already has this posture; this migration
-- records the explicit grant state for future replays and audits.

revoke execute on function public.invoke_indexing_v3_agent(integer) from public, anon, authenticated;
grant execute on function public.invoke_indexing_v3_agent(integer) to service_role;

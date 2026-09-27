-- Let the indexing-v3-agent Edge Function require a valid login token
-- (verify_jwt = true in supabase/config.toml; GitHub issue #2958).
--
-- Until now the function ran with verify_jwt = false and its shared secret
-- (x-indexing-agent-secret) was the only gate. This invoker now also sends
-- the cron JWT already held in Vault as cron_ingestion_jwt, which the
-- verify_jwt = true ingestion-worker function accepted from pg_cron. The
-- shared secret stays, so the function keeps two independent gates.
--
-- Order of rollout: this migration applies on merge and is harmless while
-- the function still runs with verify_jwt = false (the extra header is
-- ignored). The config change only takes effect when indexing-v3-agent is
-- redeployed. If cron_ingestion_jwt is absent the header is omitted rather
-- than failing here, so the gateway's 401 is the visible signal after the
-- redeploy instead of a silent change now.
--
-- Rollback: redeploy the function with verify_jwt = false; this body can
-- stay, or re-create the previous one from 20260702160000.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.invoke_indexing_v3_agent(p_limit integer default 1)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_request_id bigint;
  v_secret     text;
  v_jwt        text;
  v_headers    jsonb;
  v_base_url   text;
begin
  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = 'indexing_v3_agent_secret'
  limit 1;

  if nullif(v_secret, '') is null then
    raise exception 'indexing_v3_agent_secret is missing from Supabase Vault';
  end if;

  select decrypted_secret
    into v_jwt
  from vault.decrypted_secrets
  where name = 'cron_ingestion_jwt'
  limit 1;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-indexing-agent-secret', v_secret
  );
  if nullif(trim(v_jwt), '') is not null then
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || trim(v_jwt));
  end if;

  -- Prefer the GUC; fall back to the hardcoded production URL so that
  -- existing deployments that have not yet set the GUC continue to work.
  v_base_url := coalesce(
    nullif(current_setting('app.indexing_v3_agent_base_url', true), ''),
    'https://sjrfecxgysukkwxsowpy.supabase.co'
  );

  select net.http_post(
    url := v_base_url || '/functions/v1/indexing-v3-agent?limit='
           || greatest(1, least(coalesce(p_limit, 1), 10))::text,
    headers := v_headers,
    body := jsonb_build_object('source', 'pg_cron', 'worker', 'v3-indexing-worker', 'ts', now()),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.invoke_indexing_v3_agent(integer) from public, anon, authenticated;
grant execute on function public.invoke_indexing_v3_agent(integer) to service_role;

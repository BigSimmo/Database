-- Fix #8: Replace hardcoded project URL in invoke_indexing_v3_agent with a
-- GUC-based setting, so the function works across all environments (staging,
-- production, local) without a code change.
--
-- We store the base URL in a database-level GUC (app.indexing_v3_agent_base_url).
-- current_setting('app.indexing_v3_agent_base_url', true) returns NULL if the
-- GUC is not set, so the function retains the current project URL as its fallback,
-- meaning this change is fully backwards-compatible.

-- Set the default base URL for the current (production) project.
-- This value must be changed for staging/dev environments via:
--   ALTER DATABASE postgres SET app.indexing_v3_agent_base_url = '...';
--
-- Guarded: hosted Supabase denies ALTER DATABASE SET to the migration role
-- (42501). We swallow insufficient_privilege so the migration still succeeds on
-- hosted; the function below already falls back to the hardcoded project URL via
-- current_setting(..., true), so behaviour is unchanged when the GUC is unset.
-- On self-hosted / local (where the role is superuser) the GUC is set normally.
do $$
begin
  execute format('alter database %I set app.indexing_v3_agent_base_url = %L',
                 current_database(), 'https://sjrfecxgysukkwxsowpy.supabase.co');
exception
  when insufficient_privilege then
    raise notice 'Skipping ALTER DATABASE SET app.indexing_v3_agent_base_url (insufficient privilege on hosted Supabase); invoke_indexing_v3_agent falls back to the hardcoded URL.';
end
$$;

create or replace function public.invoke_indexing_v3_agent(p_limit integer default 1)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_request_id bigint;
  v_secret     text;
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

  -- Prefer the GUC; fall back to the hardcoded production URL so that
  -- existing deployments that have not yet set the GUC continue to work.
  v_base_url := coalesce(
    nullif(current_setting('app.indexing_v3_agent_base_url', true), ''),
    'https://sjrfecxgysukkwxsowpy.supabase.co'
  );

  select net.http_post(
    url := v_base_url || '/functions/v1/indexing-v3-agent?limit='
           || greatest(1, least(coalesce(p_limit, 1), 10))::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-indexing-agent-secret', v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron', 'worker', 'v3-indexing-worker', 'ts', now()),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

-- P3 hygiene from the 2026-07-24 Database↔Supabase interface audit:
-- mirror invoke_indexing_v3_agent by reading the ingestion-worker base URL from
-- app.ingestion_worker_base_url, with the current project URL as fallback.
--
-- Guarded: hosted Supabase denies ALTER DATABASE SET to the migration role
-- (42501). Swallow insufficient_privilege so the migration still succeeds; the
-- function falls back to the hardcoded URL via current_setting(..., true).

do $$
begin
  execute format('alter database %I set app.ingestion_worker_base_url = %L',
                 current_database(), '[REDACTED]');
exception
  when insufficient_privilege then
    raise notice 'Skipping ALTER DATABASE SET app.ingestion_worker_base_url (insufficient privilege on hosted Supabase); invoke_ingestion_worker falls back to the hardcoded URL.';
end
$$;

create or replace function public.invoke_ingestion_worker(p_limit integer default 25)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_request_id bigint;
  v_jwt text;
  v_limit integer := greatest(1, least(coalesce("p_limit", 25), 200));
  v_base_url text;
begin
  select "decrypted_secret" into v_jwt
  from "vault"."decrypted_secrets"
  where "name" = 'cron_ingestion_jwt'
  limit 1;

  if v_jwt is null or length(trim(v_jwt)) = 0 then
    raise exception 'Missing Vault secret: cron_ingestion_jwt';
  end if;

  -- Prefer the GUC; fall back to the hardcoded production URL so that
  -- existing deployments that have not yet set the GUC continue to work.
  v_base_url := coalesce(
    nullif(current_setting('app.ingestion_worker_base_url', true), ''),
    '[REDACTED]'
  );

  select "net"."http_post"(
    url := v_base_url || '/functions/v1/ingestion-worker?limit=' || v_limit::text,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_jwt
    ),
    body := jsonb_build_object('source','pg_cron','worker','ingestion-worker','ts', now()),
    timeout_milliseconds := 60000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.invoke_ingestion_worker(integer) from public, anon, authenticated;
grant execute on function public.invoke_ingestion_worker(integer) to service_role;

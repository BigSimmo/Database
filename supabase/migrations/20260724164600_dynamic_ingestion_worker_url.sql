create or replace function public.invoke_ingestion_worker(p_limit integer default 25)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault', 'pg_temp'
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

  v_base_url := coalesce(
    nullif(current_setting('app.ingestion_worker_base_url', true), ''),
    'https://sjrfecxgysukkwxsowpy.supabase.co'
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

-- Audit Remediation: Security and Hardening (ISSUE-04, ISSUE-05, ISSUE-08)

-- ISSUE-08: Replace hardcoded project URL in invoke_ingestion_worker with a GUC-based setting.
do $$
begin
  execute format('alter database %I set app.ingestion_worker_base_url = %L',
                 current_database(), 'https://sjrfecxgysukkwxsowpy.supabase.co');
exception
  when insufficient_privilege then
    raise notice 'Skipping ALTER DATABASE SET app.ingestion_worker_base_url (insufficient privilege on hosted Supabase); invoke_ingestion_worker falls back to the hardcoded URL.';
end
$$;

CREATE OR REPLACE FUNCTION public.invoke_ingestion_worker(p_limit integer DEFAULT 25)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault', 'pg_temp'
AS $function$
declare
  v_request_id bigint;
  v_jwt text;
  v_base_url text;
  v_limit integer := greatest(1, least(coalesce("p_limit", 25), 200));
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
$function$;

-- ISSUE-05: Revoke PUBLIC Execution on Invoker RPCs
revoke execute on function public.detect_legacy_ivfflat_indexes() from public, anon, authenticated;
revoke execute on function public.document_summary_text(uuid) from public, anon, authenticated;
revoke execute on function public.search_document_chunks(uuid, text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.set_document_embedding_field_content_hash() from public, anon, authenticated;

-- ISSUE-04: Align Data API Table Grants
-- To ensure fail-closed posture matches live, we explicitly revoke all privileges on all tables 
-- and sequences in schema public from anon and authenticated.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

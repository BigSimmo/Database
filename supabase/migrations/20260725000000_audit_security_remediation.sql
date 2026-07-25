-- Audit remediation: correct invoke_ingestion_worker URL fallback + harden grants.
--
-- Context: migration 20260724130100 introduced the GUC-backed worker URL pattern
-- but landed with a literal `[REDACTED]` fallback (from an earlier audit export).
-- Hosted apply of that migration can leave cron ingestion pointing at an invalid
-- base URL when `app.ingestion_worker_base_url` is unset. This follow-up restores
-- the real Clinical KB Database project URL and reasserts fail-closed grants.
--
-- ISSUE-05 / ISSUE-04 reasserts are idempotent with earlier migrations and with
-- supabase/schema.sql. Do not edit the already-applied 20260724130100 blob.

-- ISSUE-08: set GUC + replace function with the real project URL fallback.
do $$
begin
  execute format('alter database %I set app.ingestion_worker_base_url = %L',
                 current_database(), 'https://sjrfecxgysukkwxsowpy.supabase.co');
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

-- CREATE OR REPLACE can leave grants ambiguous across platforms; reassert explicitly.
revoke execute on function public.invoke_ingestion_worker(integer) from public, anon, authenticated;
grant execute on function public.invoke_ingestion_worker(integer) to service_role;

-- ISSUE-05: revoke PUBLIC / client-role execute on invoker RPCs (idempotent).
revoke execute on function public.detect_legacy_ivfflat_indexes() from public, anon, authenticated;
revoke execute on function public.document_summary_text(uuid) from public, anon, authenticated;
revoke execute on function public.search_document_chunks(uuid, text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.set_document_embedding_field_content_hash() from public, anon, authenticated;
grant execute on function public.detect_legacy_ivfflat_indexes() to service_role;
grant execute on function public.document_summary_text(uuid) to service_role;
grant execute on function public.search_document_chunks(uuid, text, integer, uuid) to service_role;
grant execute on function public.set_document_embedding_field_content_hash() to service_role;

-- ISSUE-04: Data API table/sequence fail-closed posture (idempotent with schema.sql).
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

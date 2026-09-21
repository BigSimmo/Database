set search_path = public, pg_catalog, pg_temp;

-- Revoke client EXECUTE on site-content SECURITY DEFINER RPCs. Staging does not
-- have these functions; this migration is for prod + the reconciled schema.
-- Includes PUBLIC in the revoke list so Postgres default EXECUTE and
-- check:function-grants stay closed. No indexing-v3-agent / ingestion-worker /
-- FORCE RLS changes.

revoke execute on function public.read_site_content_public_records(text, text)
  from public, anon, authenticated;
revoke execute on function public.publish_site_content_record(text, uuid, text, bigint, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.record_site_content_reconciliation_plan(jsonb)
  from public, anon, authenticated;
revoke execute on function public.retire_site_content_record(text, uuid, text, bigint, text, text, text)
  from public, anon, authenticated;

grant execute on function public.read_site_content_public_records(text, text) to service_role;
grant execute on function public.publish_site_content_record(text, uuid, text, bigint, text, text, text) to service_role;
grant execute on function public.record_site_content_reconciliation_plan(jsonb) to service_role;
grant execute on function public.retire_site_content_record(text, uuid, text, bigint, text, text, text) to service_role;

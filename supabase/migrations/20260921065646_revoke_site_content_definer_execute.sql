-- Codify prod 20260921065646. Staging has no site-content DEFINER RPCs.
-- Revoke client EXECUTE; grant service_role only. PUBLIC included so
-- check:function-grants stays closed after allowlist removal.

REVOKE EXECUTE ON FUNCTION public.read_site_content_public_records(text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_site_content_record(text, uuid, text, bigint, text, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_site_content_reconciliation_plan(jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retire_site_content_record(text, uuid, text, bigint, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_site_content_public_records(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_site_content_record(text, uuid, text, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_site_content_reconciliation_plan(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.retire_site_content_record(text, uuid, text, bigint, text, text, text) TO service_role;

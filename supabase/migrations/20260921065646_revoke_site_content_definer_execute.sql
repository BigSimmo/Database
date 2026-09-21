-- Codify prod 20260921065646 (revoke_site_content_definer_execute).
-- Staging has no site-content DEFINER RPCs — skip per-function grants when absent
-- so Preview/staging can record the version without failing REVOKE on missing procs.
-- When the functions exist (prod), effect matches the live apply: revoke client
-- EXECUTE (including PUBLIC) and grant service_role only.

DO $$
BEGIN
  IF to_regprocedure('public.read_site_content_public_records(text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.read_site_content_public_records(text, text)
      FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.read_site_content_public_records(text, text)
      TO service_role;
  END IF;

  IF to_regprocedure('public.publish_site_content_record(text, uuid, text, bigint, text, text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.publish_site_content_record(text, uuid, text, bigint, text, text, text)
      FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.publish_site_content_record(text, uuid, text, bigint, text, text, text)
      TO service_role;
  END IF;

  IF to_regprocedure('public.record_site_content_reconciliation_plan(jsonb)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.record_site_content_reconciliation_plan(jsonb)
      FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.record_site_content_reconciliation_plan(jsonb)
      TO service_role;
  END IF;

  IF to_regprocedure('public.retire_site_content_record(text, uuid, text, bigint, text, text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.retire_site_content_record(text, uuid, text, bigint, text, text, text)
      FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.retire_site_content_record(text, uuid, text, bigint, text, text, text)
      TO service_role;
  END IF;
END
$$;

-- Forward correction after 20260921065646: publication RPCs require auth.uid() and
-- jwt role = authenticated (see publish/retire/reconciliation function bodies and
-- /api/site-content/publications using publicationClient). Revoking authenticated
-- EXECUTE broke admin publish. Keep anon/public revoked; restore authenticated.
-- read_site_content_public_records stays service_role-only.

DO $$
BEGIN
  IF to_regprocedure('public.publish_site_content_record(text, uuid, text, bigint, text, text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.publish_site_content_record(text, uuid, text, bigint, text, text, text)
      FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.publish_site_content_record(text, uuid, text, bigint, text, text, text)
      TO authenticated;
  END IF;

  IF to_regprocedure('public.retire_site_content_record(text, uuid, text, bigint, text, text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.retire_site_content_record(text, uuid, text, bigint, text, text, text)
      FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.retire_site_content_record(text, uuid, text, bigint, text, text, text)
      TO authenticated;
  END IF;

  IF to_regprocedure('public.record_site_content_reconciliation_plan(jsonb)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.record_site_content_reconciliation_plan(jsonb)
      FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.record_site_content_reconciliation_plan(jsonb)
      TO authenticated;
  END IF;
END
$$;

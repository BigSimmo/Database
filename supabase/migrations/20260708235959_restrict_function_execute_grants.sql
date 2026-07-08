-- Revoke PUBLIC/anon/authenticated EXECUTE for service-invoker-only functions.
-- These functions intentionally remain internal to service-role execution paths.

set search_path = public, extensions, pg_temp;

do $$
begin
  if to_regprocedure('public.document_summary_text(uuid)') is not null then
    revoke execute on function public.document_summary_text(uuid) from public, anon, authenticated;
    grant execute on function public.document_summary_text(uuid) to service_role;
  end if;

  if to_regprocedure('public.detect_legacy_ivfflat_indexes()') is not null then
    revoke execute on function public.detect_legacy_ivfflat_indexes() from public, anon, authenticated;
    grant execute on function public.detect_legacy_ivfflat_indexes() to service_role;
  end if;

  if to_regprocedure('public.set_document_embedding_field_content_hash()') is not null then
    revoke execute on function public.set_document_embedding_field_content_hash() from public, anon, authenticated;
    grant execute on function public.set_document_embedding_field_content_hash() to service_role;
  end if;
end $$;


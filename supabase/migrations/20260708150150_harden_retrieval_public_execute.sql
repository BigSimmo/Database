-- Codify the migration version already recorded on production. These two
-- retrieval helpers are server-only, so their EXECUTE posture matches the
-- schema-wide service-role-only policy in supabase/schema.sql.

set search_path = public, extensions, pg_temp;

revoke execute on function public.retrieval_owner_matches(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.retrieval_owner_matches(uuid, uuid)
  to service_role;

revoke execute on function public.search_document_chunks(uuid, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.search_document_chunks(uuid, text, integer, uuid)
  to service_role;

-- Pin search_path on public.retrieval_owner_matches_v2 (2026-07-13 audit,
-- finding 6; Supabase advisor: function_search_path_mutable).
--
-- Every sibling wrapper created in 20260713020000_owner_plus_public_retrieval.sql
-- pins `set search_path = public, extensions, pg_temp`; this helper was the one
-- exception. Its body is a pure boolean expression over its arguments, so the
-- pinned path changes no behaviour — it only removes the mutable-search-path
-- surface and returns the production linter to green.

alter function public.retrieval_owner_matches_v2(uuid, uuid, boolean)
  set search_path = public, extensions, pg_temp;

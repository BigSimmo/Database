-- Historical migration version placeholder.
--
-- Supabase Preview (PR #2960 branch) recorded revoke_site_content_definer_execute
-- as 20260921140000 before the file was renumbered to production's
-- 20260921065646_revoke_site_content_definer_execute.sql.
--
-- Hosted Supabase Preview fails with
-- "Remote migration versions not found in local migrations directory"
-- when schema_migrations still records this version after the renumber.
-- Durable effects live in 20260921065646; this file keeps local history complete.

select 1;

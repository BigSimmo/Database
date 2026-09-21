-- Historical migration version placeholder.
--
-- Staging MCP apply_migration recorded revoke_site_content_definer_execute here (could not mint prod 65646). Durable effects live in 20260921065646_revoke_site_content_definer_execute.sql.
--
-- Hosted Supabase Preview fails with
-- "Remote migration versions not found in local migrations directory"
-- when schema_migrations still records this version after renumber/catch-up.
-- This file keeps local history complete without re-applying work.

select 1;

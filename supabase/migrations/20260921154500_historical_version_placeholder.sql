-- Historical migration version placeholder.
--
-- Repo stem before live MCP apply; Preview/PR history may still record this version. Durable effects live in 20260921072938_restore_authenticated_site_content_mutation_execute.sql (prod version).
--
-- Hosted Supabase Preview fails with
-- "Remote migration versions not found in local migrations directory"
-- when schema_migrations still records this version after renumber/catch-up.
-- This file keeps local history complete without re-applying work.

select 1;

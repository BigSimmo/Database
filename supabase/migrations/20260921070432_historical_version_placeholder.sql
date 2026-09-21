-- Historical migration version placeholder.
--
-- Staging MCP apply_migration recorded audit_logs_append_only here (could not mint prod 65653). Durable effects live in 20260921065653_audit_logs_append_only.sql. Staging also keeps older 20260921065428.
--
-- Hosted Supabase Preview fails with
-- "Remote migration versions not found in local migrations directory"
-- when schema_migrations still records this version after renumber/catch-up.
-- This file keeps local history complete without re-applying work.

select 1;

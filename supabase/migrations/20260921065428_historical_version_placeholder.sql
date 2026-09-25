-- Historical migration version placeholder.
--
-- Staging (ikoiolksxqxfxgiyqpnu) recorded audit_logs_append_only as 20260921065428.
-- Production applied the same durable effects later as
-- 20260921065653_audit_logs_append_only.sql.
--
-- Hosted Supabase Preview fails with
-- "Remote migration versions not found in local migrations directory"
-- when schema_migrations still records this version after the renumber.
-- This file keeps local history complete for Preview without re-applying work.

select 1;

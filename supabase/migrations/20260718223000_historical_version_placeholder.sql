-- Historical migration version placeholder.
--
-- Renumbered to 20260719055623_enforce_public_title_word_scope.sql (#914).
--
-- Hosted Supabase Preview fails with
-- "Remote migration versions not found in local migrations directory"
-- when schema_migrations still records this version after a rename/renumber.
-- The durable effects live in the replacement migration(s) named above.
-- This file keeps local history complete for Preview without re-applying work.

select 1;

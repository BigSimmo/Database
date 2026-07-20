-- Historical migration version placeholder.
--
-- Renamed to 20260713062125 to match applied remote history (#552).
--
-- Hosted Supabase Preview fails with
-- "Remote migration versions not found in local migrations directory"
-- when schema_migrations still records this version after a rename/renumber.
-- The durable effects live in the replacement migration(s) named above.
-- This file keeps local history complete for Preview without re-applying work.

select 1;

-- Drop redundant index (supabase-postgres-best-practices review, 2026-07-11).
--
-- clinical_registry_record_sources_record_idx (record_id) is a strict prefix of
-- the index backing the UNIQUE (record_id, document_id) constraint on
-- clinical_registry_record_sources. PostgreSQL can use the unique index's
-- leading column for every equality lookup on record_id, so the standalone
-- index adds write overhead with no read benefit. Same rationale as
-- 20260702110000_drop_redundant_indexes.sql.
--
-- clinical_registry_record_sources_document_idx stays: document_id is not a
-- leading column of any other index and backs the documents ON DELETE CASCADE.
--
-- NOTE: DROP INDEX CONCURRENTLY cannot run inside a transaction block, and
-- Supabase migrations run in one. The table is small (curated registry links),
-- so a plain DROP INDEX is fine. For zero-impact removal run manually outside
-- a transaction:
--   DROP INDEX CONCURRENTLY IF EXISTS public.clinical_registry_record_sources_record_idx;

drop index if exists public.clinical_registry_record_sources_record_idx;

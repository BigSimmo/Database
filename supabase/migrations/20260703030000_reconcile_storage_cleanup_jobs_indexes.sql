-- Reconcile storage_cleanup_jobs indexes on the LIVE database with the names /
-- definitions already declared in supabase/schema.sql (and migration
-- 20260528007000_database_hardening_before_import.sql).
--
-- Why: the live project (sjrfecxgysukkwxsowpy) carries legacy auto-generated
-- index names that predate the hardening migration, even though that migration
-- is recorded as applied in supabase_migrations.schema_migrations:
--
--   live (legacy)                              intended (schema.sql)
--   storage_cleanup_jobs_document_id_idx    -> storage_cleanup_jobs_document_idx
--   storage_cleanup_jobs_owner_id_idx       -> storage_cleanup_jobs_owner_status_idx
--                                              (owner_id, status, created_at desc)
--   storage_cleanup_jobs_status_created_idx -> storage_cleanup_jobs_status_created_idx
--     (full)                                   (partial: status in pending/failed)
--
-- All three still cover their columns on live, so this is a cosmetic +
-- optimisation reconciliation, NOT a functional fix (the document_id FK is
-- already covered). It is prepared for review only.
--
-- >>> DO NOT APPLY TO LIVE without explicit approval. <<<
--
-- Idempotent and safe on a fresh `supabase db reset` too: the legacy names
-- never exist there so the drops are no-ops, and the intended indexes already
-- match schema.sql so the creates are no-ops. The status index shares its name
-- across both shapes, so it is dropped and recreated to guarantee the partial
-- form (a negligible rebuild of a small index).
--
-- NOTE for the applier: these are plain (transactional) statements. If you want
-- a lock-free rebuild on a busy table, run the DROP/CREATE steps manually with
-- CONCURRENTLY *outside* a transaction instead -- CONCURRENTLY cannot run inside
-- the migration transaction. storage_cleanup_jobs is small, so the brief lock
-- from the plain form is normally fine.

-- document_id FK covering index: legacy auto-name -> intended name
drop index if exists storage_cleanup_jobs_document_id_idx;
create index if not exists storage_cleanup_jobs_document_idx
  on public.storage_cleanup_jobs(document_id);

-- owner index: legacy single-column -> intended composite
drop index if exists storage_cleanup_jobs_owner_id_idx;
create index if not exists storage_cleanup_jobs_owner_status_idx
  on public.storage_cleanup_jobs(owner_id, status, created_at desc);

-- status index: same name, ensure the partial (pending/failed) form
drop index if exists storage_cleanup_jobs_status_created_idx;
create index if not exists storage_cleanup_jobs_status_created_idx
  on public.storage_cleanup_jobs(status, created_at)
  where status in ('pending', 'failed');

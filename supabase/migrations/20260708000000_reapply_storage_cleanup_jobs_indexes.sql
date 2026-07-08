-- Re-apply the storage_cleanup_jobs index reconciliation whose effects are
-- ABSENT on live despite 20260703030000 being recorded as applied in live
-- migration history (verified 2026-07-07 via schema_drift_snapshot: live still
-- carries the legacy auto-generated names and a non-partial status index).
--
-- "Recorded as applied but ineffective" is the original drift incident class,
-- recurring. Rather than rewrite history, this new version re-applies the same
-- idempotent statements from 20260703030000 so live converges with
-- supabase/schema.sql. storage_cleanup_jobs is a small operational table, so the
-- brief lock from the transactional DROP/CREATE is acceptable; the document_id
-- FK stays covered throughout (the old index is dropped and the new one created
-- in the same transaction).
--
-- Idempotent: on a database that already matches schema.sql (fresh replay) the
-- legacy names do not exist so the drops are no-ops and the intended indexes
-- already exist so the creates are no-ops.

set search_path = public, extensions, pg_temp;

-- document_id FK covering index: legacy auto-name -> intended name
drop index if exists public.storage_cleanup_jobs_document_id_idx;
create index if not exists storage_cleanup_jobs_document_idx
  on public.storage_cleanup_jobs(document_id);

-- owner index: legacy single-column -> intended composite
drop index if exists public.storage_cleanup_jobs_owner_id_idx;
create index if not exists storage_cleanup_jobs_owner_status_idx
  on public.storage_cleanup_jobs(owner_id, status, created_at desc);

-- status index: same name, ensure the partial (pending/failed) form
drop index if exists public.storage_cleanup_jobs_status_created_idx;
create index if not exists storage_cleanup_jobs_status_created_idx
  on public.storage_cleanup_jobs(status, created_at)
  where status in ('pending', 'failed');

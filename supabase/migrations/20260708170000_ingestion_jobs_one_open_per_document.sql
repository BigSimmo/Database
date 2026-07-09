-- R17 (docs/ingestion-concurrency-fix-workorder.md): no constraint currently
-- prevents multiple open ingestion_jobs rows per document; the reindex
-- enqueue race (R13) and duplicate reindex POSTs previously relied on
-- application-side advisory checks (a SELECT immediately before INSERT),
-- which is a check-then-act race. This index makes the invariant structural.
--
-- Uses a transactional CREATE UNIQUE INDEX (not CONCURRENTLY) so `supabase db
-- push` and Supabase Preview replay can apply it inside a transaction. Stem
-- 20260708160000 is a neutralized no-op retained for preview history parity;
-- this migration carries the actual index DDL.
--
-- Before applying on live, confirm `npm run reindex:health` reports
-- jobs_pending = 0 and jobs_processing = 0 (live had 0/0 as of 2026-07-08).
-- On a busy queue, prefer the lock-free form from
-- docs/operator-apply-july8-batch.md (CREATE INDEX CONCURRENTLY outside a
-- transaction), then `supabase migration repair --linked --status applied
-- 20260708170000`.
--
-- Paired app change (already on main): reindex routes translate 23505 into 409.

create unique index if not exists ingestion_jobs_one_open_per_document_uidx
  on public.ingestion_jobs (document_id)
  where status in ('pending', 'processing');

-- R17 (docs/ingestion-concurrency-fix-workorder.md): no constraint currently
-- prevents multiple open ingestion_jobs rows per document; the reindex
-- enqueue race (R13) and duplicate reindex POSTs previously relied on
-- application-side advisory checks (a SELECT immediately before INSERT),
-- which is a check-then-act race. This index makes the invariant structural.
--
-- NOT applied via `supabase db push` — CLI migrations run inside a
-- transaction and `CONCURRENTLY` cannot run inside one
-- (docs/supabase-migration-reconciliation.md, "Index replacements" rule).
-- Operator: apply the statement below manually against live (outside a
-- transaction, e.g. `supabase db query --linked` or the SQL editor with
-- autocommit), after confirming `npm run reindex:health` reports
-- jobs_pending = 0 and jobs_processing = 0 (live had 0/0 as of 2026-07-08,
-- so creation will not fail on existing duplicates). Then run
-- `supabase migration repair --linked --status applied 20260708160000` so
-- history matches effect, per policy.
--
-- Paired app change (same release, already shipped in this PR): the
-- single-document and bulk reindex routes translate a 23505 unique
-- violation on job insert into the same 409 "already queued" response the
-- pre-check produces, instead of a raw constraint 500
-- (src/app/api/documents/[id]/reindex/route.ts,
-- src/app/api/documents/bulk/reindex/route.ts).

create unique index concurrently if not exists
  ingestion_jobs_one_open_per_document_uidx
  on public.ingestion_jobs (document_id)
  where status in ('pending', 'processing');

-- Fix #6: Add retention policy for rag_retrieval_logs and document audit_logs intent.
--
-- rag_queries already has a purge cron (20260629100000). rag_retrieval_logs has
-- no TTL. We add a matching cron to purge rows older than 90 days.
-- audit_logs is intentionally kept indefinitely (compliance requirement); add a
-- comment so this is self-documenting and not mistaken for an oversight.

comment on table public.audit_logs is
  'Append-only audit trail. Rows are retained indefinitely for compliance.
   Writes are best-effort (fire-and-forget) from the application layer; a write
   failure is swallowed and does not affect the calling request.
   Do NOT add an automatic purge to this table without a compliance review.';

comment on table public.rag_retrieval_logs is
  'Per-request retrieval telemetry. Rows older than 90 days are purged nightly
   by the pg_cron job "purge-rag-retrieval-logs". Adjust the retention window
   by changing the interval in that cron job definition.';

-- Register the nightly purge cron job.
-- cron.schedule is idempotent on the job name; re-running this migration is safe.
select cron.schedule(
  'purge-rag-retrieval-logs',
  '0 3 * * *',   -- 03:00 UTC daily
  $$
    delete from public.rag_retrieval_logs
    where created_at < now() - interval '90 days';
  $$
);

-- Fix #12: Add explanatory comment to claim_ingestion_jobs explaining the
-- dual-lock (FOR UPDATE OF j, d SKIP LOCKED) pattern. No behaviour change.

comment on function public.claim_ingestion_jobs(text, integer, integer) is
  'Claims up to p_limit pending/failed ingestion jobs for the given worker_id.
   Uses "FOR UPDATE OF j, d SKIP LOCKED" to lock both the ingestion_job row (j)
   and the parent document row (d) in a single CTE scan. Locking the document
   prevents two concurrent workers from racing on the same document even when
   separate ingestion jobs reference it (e.g. a retry and a re-queue arriving
   simultaneously). SKIP LOCKED ensures a busy document is silently bypassed
   rather than causing a block, giving other workers fair access.';

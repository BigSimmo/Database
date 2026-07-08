-- Audit R24e: drop ingestion_job_stages.job_id -> ingestion_jobs foreign key.
--
-- Resolves drift-reconciliation backlog item #8 in the direction the LIVE
-- evidence supports (the opposite of the earlier "add the FK to live" plan):
--
--   * Live never had this FK; the constraint exists only in schema.sql and the
--     migration chain, so fresh/preview databases diverge from live.
--   * The edge agent's stageStart (supabase/functions/indexing-v3-agent) writes
--     the indexing_v3_agent_jobs id into job_id, which can never satisfy a FK to
--     ingestion_jobs — so on any database where the FK exists the agent's
--     artifact-repair path dies at its first stage insert (FK 23503).
--   * Live carries 253 stage rows whose job_id has no ingestion_jobs match
--     (job deletions leave audit-log stages behind, with no FK to cascade them).
--     Adding the FK NOT VALID + VALIDATE would fail VALIDATE against those rows.
--
-- job_id stays as an opaque correlation id (still NOT NULL). schema.sql is
-- reconciled to omit the FK and supabase/drift-allowlist.json drops its
-- now-obsolete entry in the same change. Idempotent: no-op on live (already
-- absent), removes the constraint on branch/preview databases created from the
-- pre-R24e migration chain.

set search_path = public, extensions, pg_temp;

alter table public.ingestion_job_stages
  drop constraint if exists ingestion_job_stages_job_id_fkey;

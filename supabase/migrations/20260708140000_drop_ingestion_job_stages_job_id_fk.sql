-- R24e: remove the phantom ingestion_job_stages.job_id -> ingestion_jobs FK.
--
-- Rationale (docs/ingestion-state-machine.md finding R24e;
-- docs/ingestion-concurrency-fix-workorder.md): schema.sql and migration
-- 20260625000000 declare
--   job_id uuid not null references public.ingestion_jobs(id) on delete cascade,
-- but this constraint is ABSENT on the live project, and the column holds
-- indexing_v3_agent_jobs ids (the edge agent's stageStart writes the agent-job
-- id into job_id), not ingestion_jobs ids. On any schema.sql- or
-- migration-provisioned environment the FK makes every needs-work agent run die
-- at its first stage insert (FK violation 23503) and burn attempts to terminal
-- failed. Live carries ~253 orphan stage rows and 0 rows whose job_id resolves
-- to an ingestion_jobs row, so ADDING + VALIDATE-ing the FK (the prior
-- drift-allowlist plan) would both destroy stage-log history and break the
-- agent. Drop it so fresh/preview environments match live. Document cleanup is
-- still covered by ingestion_job_stages.document_id -> documents ON DELETE
-- CASCADE, which is the FK live actually has.
--
-- Idempotent: a no-op on live (already absent). schema.sql is reconciled to
-- match this and supabase/drift-manifest.json is regenerated in the same change;
-- the matching supabase/drift-allowlist.json entry is removed. Supersedes
-- reconciliation-backlog item #8 in docs/database-drift-detection.md.

alter table if exists public.ingestion_job_stages
  drop constraint if exists ingestion_job_stages_job_id_fkey;

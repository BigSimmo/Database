-- Fix #9: Drop redundant indexes.
--
-- 1. documents_owner_hash_idx (owner_id, content_hash) is a plain non-unique
--    index whose column set is a strict subset of the UNIQUE partial index
--    documents_owner_content_hash_unique_idx (owner_id, content_hash WHERE
--    content_hash IS NOT NULL). The unique index is used for duplicate detection
--    (ON CONFLICT) and also satisfies all equality lookups on (owner_id,
--    content_hash). The plain index adds write overhead with no read benefit.
--
-- NOTE: DROP INDEX CONCURRENTLY cannot run inside a transaction block.
-- Supabase migrations are wrapped in a transaction by default, which means
-- CONCURRENTLY is not available here. We use a plain DROP INDEX instead;
-- the table is small relative to write load and this is a one-time maintenance
-- operation. If you prefer zero-impact removal, run this statement manually in
-- the Supabase SQL editor outside a transaction:
--   DROP INDEX CONCURRENTLY IF EXISTS public.documents_owner_hash_idx;

drop index if exists public.documents_owner_hash_idx;

-- 2. ingestion_jobs_claim_idx covers (status, next_run_at, created_at) WHERE
--    status IN ('pending','processing'). The superset index
--    ingestion_jobs_status_next_run_idx covers the same columns with WHERE
--    status IN ('pending','processing','failed'). PostgreSQL can use the
--    superset index for any query the subset index would satisfy, so the subset
--    index is fully redundant once the superset exists.

drop index if exists public.ingestion_jobs_claim_idx;

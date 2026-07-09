-- NEUTRALIZED 2026-07-09 — DO NOT DELETE THIS FILE.
--
-- Supabase Preview branch mouqbgieqejpamctasbu (PR #433) recorded this stem
-- after the original CONCURRENTLY definition shipped. Removing the file breaks
-- preview sync with "Remote migration versions not found in local migrations
-- directory." The transactional index creation lives in
-- 20260708170000_ingestion_jobs_one_open_per_document.sql; on live, prefer the
-- lock-free CONCURRENTLY path in docs/operator-apply-july8-batch.md when the
-- queue is idle, then repair history to match effect.

select 1 where false;

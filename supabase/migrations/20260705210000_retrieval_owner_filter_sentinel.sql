-- NEUTRALIZED 2026-07-08 — DO NOT RESTORE THE ORIGINAL RPC BODIES.
--
-- This migration originally rewrote retrieval_owner_matches() plus ~10 retrieval
-- RPCs. It was never applied to the live project. The 2026-07-08 pre-apply
-- investigation (docs/database-drift-detection.md) found that:
--
--   1. Its actual purpose — the public-owner sentinel in retrieval_owner_matches
--      (owner_filter = '000…000' -> row_owner_id IS NULL) — is ALREADY live and
--      identical, so the owner-scoping change was a no-op relative to live.
--   2. Live has DIVERGED FORWARD from these bodies via later raw-SQL work that
--      was never captured in a migration: match_document_chunks carries an
--      hnsw.ef_search=100 plpgsql wrapper (higher vector recall);
--      match_document_chunks_text and match_document_table_facts_text carry
--      richer multi-strategy implementations; match_document_chunks_hybrid uses
--      a left-join for quality_score.
--
-- Applying the original migration would therefore REGRESS live retrieval
-- quality. The RPC rewrites are neutralized so a future `supabase db push` can
-- never overwrite the newer live bodies. We still create retrieval_owner_matches
-- here so later migrations (e.g. 20260706130000) succeed on fresh preview
-- branches. Forward-codify the live RPC bodies separately (drift backlog).

select 1 where false; -- neutralized sentinel: original ~10 RPC rewrites removed

set search_path = public, extensions, pg_temp;

create or replace function public.retrieval_owner_matches(owner_filter uuid, row_owner_id uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_catalog
as $$
  select case
    when owner_filter is null then true
    when owner_filter = '00000000-0000-0000-0000-000000000000'::uuid then row_owner_id is null
    else row_owner_id = owner_filter
  end;
$$;

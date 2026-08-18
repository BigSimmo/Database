-- Codify the SET work_mem attribute already live on ten match_* retrieval RPCs.
--
-- Plan of record: docs/database-remediation-plan.md Phase 3 (reframed 2026-08-18);
-- evidence: docs/audit/live-drift-forensics-2026-08.md section 1.2 (per-function
-- dossier) and section 2.3/2.4 (staging replay). Ledger anchor #316.
--
-- WHY: every one of the ten match_* def_hash mismatches reported by the live-drift
-- check is attribute-only. The live pg_get_functiondef carries `SET work_mem TO
-- '...'`, and stripping exactly that line reproduces the repo hash byte-for-byte for
-- 10/10 (forensics 1.2, Query 3). Bodies, signatures, return shapes, volatility,
-- search_path/plan_cache_mode clauses and ACLs are identical to the repo. Zero body
-- divergences, zero repo-ahead. This migration records the live attribute in the
-- chain and supabase/schema.sql now mirrors it, so the drift manifest hashes match.
--
-- Owner decisions in force (docs/database-remediation-coordination.md):
--   D1 codify-as-live — each function keeps exactly the value recorded live:
--      128MB on the four hybrids named below, 64MB on the other six. No hosted
--      value changes.
--   D2 eval-canary exemption — work_mem is planner/executor memory (hash vs sort,
--      spill vs in-memory): latency only, result set determined by each RPC's
--      ORDER BY ... LIMIT. RAG impact: no retrieval behaviour change.
--
-- Why a new migration and not an edit of 20260724000000_optimize_rpc_work_mem:
--   * 20260724120000_table_facts_plpgsql_execute re-creates
--     match_document_table_facts_text with CREATE OR REPLACE, which resets the
--     config-item set, so a clean chain replay leaves it WITHOUT work_mem
--     (measured on staging: 7 of 8 carry it, forensics 2.4 finding 3).
--   * match_document_chunks_text_v2 and match_document_index_units_hybrid_v2 were
--     never given work_mem by any migration; live carries it.
--   * The four hybrids are 128MB live; no recorded migration sets 128MB.
--   Versioned after every create-or-replace of each function (newest bodies:
--   20260701140631, 20260714110000, 20260717162000, 20260724120000), so a clean
--   replay ends with the attribute present in the same [search_path,
--   (plan_cache_mode), work_mem] proconfig order live shows.
--
-- Idempotent on production (sjrfecxgysukkwxsowpy): the ten values already match, so
-- ALTER FUNCTION ... SET is a no-op there. Applying it needs only the ordinary
-- production migration window; it does not change hosted state.

set search_path = public, extensions, pg_temp;

-- 128MB — live value on the four hybrids (D1: keep as-is)
ALTER FUNCTION public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '128MB';
ALTER FUNCTION public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '128MB';
ALTER FUNCTION public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '128MB';
ALTER FUNCTION public.match_document_index_units_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) SET work_mem = '128MB';

-- 64MB — live value on the other six
ALTER FUNCTION public.match_document_chunks_text(text, integer, uuid[], uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_chunks_text_v2(text, integer, uuid[], uuid, boolean) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_lookup_chunks_text(text, uuid[], integer, uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_memory_cards_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_table_facts_text(text, integer, uuid[], uuid) SET work_mem = '64MB';

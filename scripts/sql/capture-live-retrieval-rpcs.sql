-- capture-live-retrieval-rpcs.sql  (READ-ONLY)
--
-- Captures the VERBATIM live bodies of the retrieval RPCs that are still flagged
-- "LIVE IS AHEAD" in supabase/drift-allowlist.json, so their definitions can be
-- forward-codified into a migration + supabase/schema.sql WITHOUT hand-authoring
-- them. These bodies are complex, have diverged in both directions (e.g. the
-- fail-closed retrieval_owner_matches predicate was applied to live while live
-- also grew richer multi-strategy candidate sets), and are under active
-- concurrent multi-session editing — so only a verbatim capture is correct. A
-- hand-written body is exactly what got migration 20260705210000 neutralized.
--
-- SCOPE: this covers ONLY the allowlist "LIVE IS AHEAD" retrieval subset — the
-- guard-tested set (tests/forward-codify-retrieval-targets.test.ts). It is NOT
-- the complete codification set. The runbook also codifies live-only
-- (unexpected_live) and "verify" functions — get_visual_evidence_cards,
-- run_visual_eval_case, run_all_visual_eval_cases, repair_enrichment_quality_batch,
-- match_document_index_units_hybrid, match_document_memory_cards_hybrid[_v2].
-- Capture those from the fingerprint table in
-- docs/forward-codify-retrieval-rpcs-workorder.md, not here.
--
-- Full procedure: docs/forward-codify-retrieval-rpcs-workorder.md
-- Backlog item 0: docs/database-drift-detection.md#reconciliation-backlog
--
-- HOW TO RUN — this is a provider action (it reads the live project); get
-- explicit approval first and run it only when the live DB is QUIESCENT (no
-- concurrent edits to these functions). It changes nothing — it only reads
-- pg_proc. Run it via the Supabase Dashboard SQL editor, an approved
-- service-role SQL path, or the Supabase MCP execute_sql tool.
--
-- Expect EXACTLY 7 rows back (one per target). A target that no longer resolves
-- on live (renamed, dropped, or already reconciled) is filtered out and simply
-- yields FEWER rows — the query does not error. If you get fewer than 7, find
-- which with the "missing signatures" snippet in the work-order and reconcile
-- the target set + allowlist before continuing.
--
-- search_path is pinned to '' so oid::regprocedure renders fully-qualified and
-- matches the allowlist keys / schema_drift_snapshot() signatures exactly, and
-- so pg_get_functiondef emits fully-qualified, replay-safe text (the same style
-- as migrations 20260701140631 / 20260707000000). This is cosmetic, not
-- correctness-critical: check:drift hashes pg_get_functiondef under search_path
-- '' on both live and the schema.sql replay, so a verbatim body always hashes
-- equal regardless of how it was rendered at capture time.

set search_path = '';

select
  r.signature,
  pg_get_functiondef(r.proc) as definition
from (
  select t.signature, to_regprocedure(t.signature) as proc
  from (
    -- >>> forward-codify targets >>> (kept in lockstep with the "LIVE IS AHEAD"
    -- retrieval entries in supabase/drift-allowlist.json — see
    -- tests/forward-codify-retrieval-targets.test.ts)
    values
      ('public.get_related_document_metadata(uuid[],uuid)'),
      ('public.match_document_chunks(extensions.vector,integer,double precision,uuid,uuid)'),
      ('public.match_document_chunks_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)'),
      ('public.match_document_chunks_text(text,integer,uuid[],uuid)'),
      ('public.match_document_table_facts_text(text,integer,uuid[],uuid)'),
      ('public.match_documents_for_query(text,integer,uuid)'),
      ('public.repair_strict_enrichment_gate_batch(integer)')
    -- <<< forward-codify targets <<<
  ) as t(signature)
) as r
where r.proc is not null
order by r.signature;

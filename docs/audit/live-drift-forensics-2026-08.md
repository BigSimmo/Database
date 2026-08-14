# Live-drift forensics — 2026-08-14 incident session

Project: `sjrfecxgysukkwxsowpy` (Clinical KB Database). Access: owner-authorized Supabase
connector, this session. All timings from live production probes against
`https://psychiatry.tools/api/search` (unauthenticated public scope).

## Incident

Owner report: live answers showing "no sources". Health endpoint healthy
(`demoMode:false`, `supabaseConfig:ok`, `openaiConfig:ok`, deploy `d47aa6d`).

## Before-measurements

| Probe              | Query style                                   | Total  | supabase_rpc_latency_ms |
| ------------------ | --------------------------------------------- | ------ | ----------------------- |
| 2026-08-14 probe 2 | semantic (mood stabiliser / kidney)           | 37.7 s | **31,610**              |
| 2026-08-14 probe 4 | semantic (valproate bloods), post first index | 29.9 s | 21,757                  |

With `answerRouteBudgetMs.fast = 25000`, generation starves on such queries and the answer
degrades toward source-only / no-sources UX (#231 rung-2 evidence: pre-generation latency
measured as binding).

## Findings

1. Migration history fingerprint (`supabase_migrations.schema_migrations`):
   `20260705180000 reconcile_search_health_indexes` recorded **14 executed statements** —
   not mark-applied. Guard `20260804110240 restore_rag_search_health_indexes` applied
   2026-08-04 with its statement, i.e. its guarded indexes existed on that date.
   Mark-applied-style rows (`stmt_count 0`) exist only in the 2026-07-01…07-02 and
   2026-07-12 reconciliation clusters, consistent with the recorded history repairs.
2. Live index inventory: of the ten `20260705180000` indexes, exactly two were missing —
   `documents_title_trgm_idx` and `document_chunks_content_trgm_idx`. The other eight
   (labels/summaries trgm, table-facts, index-units, pages, sections, retrieval-log indexes)
   were present.
3. Timeline ⇒ the two indexes were **dropped between 2026-08-04 (guard passed) and
   2026-08-09 (red drift run 31330856982)**. No app/worker/edge-function code issues
   `DROP INDEX`. Attribution unresolved: most plausible candidates are a manual/dashboard
   action (e.g. accepting a Supabase "unused index" advisor suggestion) — the owner should
   check the Supabase dashboard query/audit history for `DROP INDEX` in that window.
4. Table sizes at repair time: `document_chunks` 1562 MB / 70,120 rows; `documents`
   18 MB / 3,301 rows.

## Repair (owner-approved, this session)

`CREATE INDEX CONCURRENTLY IF NOT EXISTS` for both indexes, definitions verbatim from
`supabase/migrations/20260705180000_reconcile_search_health_indexes.sql`, then `ANALYZE`
on both tables. Validation: `pg_index.indisvalid = indisready = true`;
`document_chunks_content_trgm_idx` = 68 MB, `documents_title_trgm_idx` = 648 kB.
No repo schema change needed — the definitions were already codified; this was the
documented operator prebuild for a drifted hosted target.

## After-measurements

| Probe   | Query style                                     | Total  | supabase_rpc_latency_ms |
| ------- | ----------------------------------------------- | ------ | ----------------------- |
| probe 5 | semantic (clozapine monitoring), text fast path | 4.8 s  | **1,535**               |
| probe 6 | semantic (mood stabiliser / renal), hybrid      | 17.2 s | 8,519                   |

Single-RPC checks after repair: `match_document_chunks_text_v2` 14 ms;
`match_documents_for_query_v2` 15 ms; `match_document_table_facts_text_v2` 77 ms;
`correct_clinical_query_terms` 50 ms.

## Residuals (tracked, not fixed here)

- Hybrid-path fan-out still costs ~8.5 s worst-observed; the 19 other drift findings and the
  10 diverged `match_*` RPC bodies (protected RAG surface) remain with
  `docs/database-remediation-plan.md` Phases 1.2–4.
- Dropper attribution (finding 3) — owner action.
- Detection hardening landed separately as PR #1939 (failure→pinned issue routing +
  post-migration trigger).

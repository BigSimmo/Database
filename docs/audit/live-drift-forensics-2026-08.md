# Live-drift forensics — 2026-08

Evidence record for the phased database remediation plan and playbook. No hosted reads or mutations
were performed while creating this file. Add dated, source-linked evidence here as each approved
phase completes.

**Tracking anchor:** ledger `#316` — "Live DB is missing 21 repo-defined indexes and 10 retrieval
RPC bodies diverge; weekly live-drift has been red since 2026-07-26 with no routing". Update it via
`npm run issues:update` at the end of every phase; never hand-edit `docs/outstanding-issues.md`.

**Plan of record:** [`docs/database-remediation-plan.md`](../database-remediation-plan.md) and
[`docs/database-remediation-playbook.md`](../database-remediation-playbook.md). Read both before
adding to this file.

**How to use this file.** Every section below is deliberately empty until its phase runs inside an
approved hosted window. Record the decisive output — pasted lines, run IDs, dates — not a summary
and not an exit code. An empty section means the phase has not run; it never means the phase found
nothing. Leave a section empty rather than filling it from inference.

## Phase 0 — Enablement (repo-side, no hosted access)

_2026-08-14._ Drift-failure routing and the post-migration trigger landed in
`.github/workflows/live-drift.yml`: a failed run now creates or updates a single pinned issue
titled "Live drift check failing" (label `live-drift-failure`) carrying the captured finding lines
and the run URL, and the next green run comments the resolution and closes it. The workflow also
runs on pushes to `main` touching `supabase/migrations/**` or `supabase/schema.sql`. Schedule,
`workflow_dispatch`, the secret preflight, and `concurrency.cancel-in-progress: false` were kept
unchanged. No hosted Supabase call was made.

Outstanding for the operator: dispatch `live-drift` once to confirm a real failure produces the
pinned issue (provider-backed — not run from the authoring session), and add
`SUPABASE_ACCESS_TOKEN` to environment secrets per plan step 0.3 and ledger `#183`.

## Phase 1 — Read-only forensics

_Partially run 2026-08-14 in an owner-authorized incident window; 1.2 and the audit-history
pairing remain pending._

### 1.1 Migration-history fingerprint

_2026-08-14 (owner-authorized Supabase connector session, incident-driven partial run)._
Full `schema_migrations` fingerprint captured. Decisive rows:

- `20260705180000 reconcile_search_health_indexes` — `no_statements = false`, **stmt_count 14**.
  It does **not** carry the mark-applied signal: its DDL was recorded as executed.
- `20260804110240 restore_rag_search_health_indexes` (the guard) — applied with its statement on
  2026-08-04, meaning the guarded indexes existed and validated on that date.
- Rows with the mark-applied signal (`statements IS NULL` or empty): the 2026-07-01…07-02 cluster
  (`fix_chunks_hybrid_perf_and_ambiguity`, `fix_remaining_hybrid_perf_and_ambiguity`,
  `schema_health_hybrid_execution_smoke`, `drop_dead_drifted_hybrid_variants`,
  `clinical_query_term_trgm_correction`, `commit_generation_preserve_legacy_artifacts`,
  `add_claim_ingestion_jobs_comment`, `drop_redundant_indexes`, `rag_retrieval_logs_retention`,
  `storage_cleanup_jobs_document_fk`, `fix_reset_document_index_duplicate`,
  `documents_owner_covering_index`, `fix_invoke_agent_url_to_guc`,
  `promote_index_generation_id_columns`) and the 2026-07-12 reconciliation batch
  (`reconcile_ingestion_index_shapes` … `add_legacy_index_health_batch_repair`, stmt_count 0).

**Conclusion for the two retrieval-critical indexes:** created and validated ≤ 2026-08-04, then
**dropped between 2026-08-04 and the red drift run of 2026-08-09** (Actions 31330856982). No
app/worker/edge-function code issues `DROP INDEX` (repo grep, this session), so the dropper was a
manual/dashboard action — plausibly an accepted "unused index" advisor suggestion. Pairing with the
dashboard audit/query history for that window remains **pending** (owner action). `#248` stays open.

### 1.2 RPC divergence dossier

_Pending._ One entry per mismatched `match_*` function, each classified **live-ahead**,
**repo-ahead**, **normalization noise**, or **UNCLASSIFIED**, quoting the decisive diff hunk.
Protected RAG surface: an ambiguous diff is recorded as UNCLASSIFIED and escalated, never guessed.

### 1.3 Index inventory, sizing, and EXPLAIN baselines

_2026-08-14 (partial — retrieval-critical scope only)._ Live inventory of the ten
`20260705180000` indexes: **exactly two missing** — `documents_title_trgm_idx` and
`document_chunks_content_trgm_idx`; the other eight present (labels/summaries trgm, table-facts,
index-units, pages, sections, both `rag_retrieval_logs` indexes). Owning tables at repair time:
`document_chunks` 1562 MB / 70,120 live rows; `documents` 18 MB / 3,301 rows.

Before-measurements came from live production probes rather than raw EXPLAIN (the incident was
end-to-end visible): `/api/search` semantic query 2026-08-14 → total 37.7 s,
`supabase_rpc_latency_ms` **31,610**; a second semantic probe 29.9 s / 21,757. The remaining
missing-index sizing and the `rag_retrieval_logs` miss-scan baseline are **pending**.

## Phase 2 — Staging parity rehearsal

_Not yet run. Requires an approved staging window; production stays read-only._

_Pending._ Migration-replay tail, any migration that misbehaved on clean replay (a finding in its
own right), and the green `check:drift` output against staging.

## Phase 3 — RPC reconciliation

_Not yet run. Requires an approved production window, plus a separate canary approval per
repo-ahead RPC._

_Pending._ Per-RPC outcome against the Phase 1.2 classification, the migration that codified each
live-ahead body, and eval-canary evidence (36/36, recall 1.0, zero per-case rr regressions) for any
behaviour-changing deploy.

## Phase 4 — Index restoration

_2026-08-14 (partial, incident-driven: the two retrieval-critical indexes only, owner-approved
"i authorise" in-session)._ Executed via the owner-authorized Supabase connector:

- `create index concurrently if not exists documents_title_trgm_idx …` — definition verbatim from
  `20260705180000`. Result: `indisvalid = true`, `indisready = true`, 648 kB.
- `create index concurrently if not exists document_chunks_content_trgm_idx …` — same source.
  Result: `indisvalid = true`, `indisready = true`, 68 MB.
- `ANALYZE public.documents; ANALYZE public.document_chunks;` after both builds.

Deviation from the phase template, recorded honestly: no PITR restore point was captured first —
the operation was additive index creation with a one-statement rollback
(`drop index concurrently`), no data-loss surface. No migration was added: the definitions are
already codified in `20260705180000` + `schema.sql`; this was the documented operator prebuild for
a drifted hosted target. The other 19 drift findings, the 2 unexpected live indexes, and the green
live-drift dispatch remain **pending** for the full phase.

## Phase 5 — Measure and close the loop

_Partially run 2026-08-14 (incident scope); full close-out still requires the remaining phases._

_2026-08-14 (partial)._ Before/after production probes (identical endpoint and query style):

| Measurement                                                         | Before               | After restore + ANALYZE |
| ------------------------------------------------------------------- | -------------------- | ----------------------- |
| Semantic query, text fast path — total / `supabase_rpc_latency_ms`  | 37.7 s / 31,610      | 4.8 s / **1,535**       |
| Semantic query, hybrid strategy — total / `supabase_rpc_latency_ms` | 29.9 s / 21,757      | 17.2 s / 8,519          |
| `match_document_chunks_text_v2` single call                         | (dominated the 31 s) | 14 ms                   |

**#231 verdict from this evidence:** the 25 s fast-route budget was being consumed by retrieval
itself while the two trigram indexes were missing — pre-generation latency was the binding cause
of semantic-query source-only fallbacks in this window (README §A1 ladder rung 2, now measured).
The A1/S1 packet must re-verify `generation_quality_gate:*` dominance on healthy latency before
choosing any code mitigation. Residual: hybrid fan-out still costs ~8.5 s worst-observed — owned
by the remaining remediation phases, not a route-budget change (`#231`'s stop condition stands).
`check:production-readiness` on the final state is **pending**.

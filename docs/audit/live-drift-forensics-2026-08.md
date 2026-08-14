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

_2026-08-14, forced-dispatch proof (owner-authorized)._ `live-drift` dispatched on `main`
(Actions run `31813064485`). The definition-of-done behaviour was observed end-to-end:

- `live-drift` job **failed** at `Compare live schema drift`, as intended for this proof.
- `Capture drift and migration-history findings` still ran (`if: always()`), and
  `Align migration history for Supabase Preview` correctly **skipped** after the failing step.
- The separate `drift-routing` job then ran (`if: ${{ !cancelled() }}`) and **succeeded**,
  creating issue **#1963 "Live drift check failing"** with label `live-drift-failure`, the run
  URL, `Job result: failure`, `Trigger: workflow_dispatch`, and the full findings block.

That run also supersedes the stale 2026-08-09 figures this file was opened with. Measured
2026-08-14, `UNEXPECTED DRIFT (32)`:

| Category                                 | 2026-08-09 | 2026-08-14         |
| ---------------------------------------- | ---------- | ------------------ |
| `match_*` function `def_hash` mismatches | 10         | **10 — unchanged** |
| `missing_live` indexes                   | 21         | **20**             |
| `unexpected_live` indexes                | 2          | **2 — unchanged**  |

`documents_title_trgm_idx` and `document_chunks_content_trgm_idx` are absent from the missing
list, independently corroborating the Phase 4 restoration below (verified separately by
read-only query against `sjrfecxgysukkwxsowpy`: both `indisvalid`/`indisready`, 648 kB and
68 MB). The 10 RPC mismatches are untouched, so **Phase 3 remains entirely outstanding** and is
the next step per the plan's ordering.

Routing is also covered offline by `tests/live-drift-workflow.test.ts` (mutation-verified), so a
future regression fails a test rather than waiting for a live failure to be mishandled.

Outstanding for the operator: add `SUPABASE_ACCESS_TOKEN` to environment secrets per plan step
0.3 and ledger `#183` (dashboard work; names only, never values).

## Phase 1 — Read-only forensics

_Partially run 2026-08-14 in an owner-authorized incident window, then extended the same day in a
read-only connector session. 1.2 is enumerated and noise-separated but its per-function diff hunks,
the remaining index sizing, and the dashboard audit-history pairing remain pending._

### 1.1 Migration-history fingerprint

_2026-08-14 (owner-authorized Supabase connector session, incident-driven partial run)._
Full `schema_migrations` fingerprint captured. Decisive rows:

- `20260705180000 reconcile_search_health_indexes` — `no_statements = false`, **stmt_count 14**.
  It does **not** carry the mark-applied signal: its DDL was recorded as executed.
- `20260804110240 restore_rag_search_health_indexes` (the guard) — applied with its statement on
  2026-08-04. Note (per PR #1960 review): that guard validates four **other** indexes and never
  checks this pair, so its application gives **no** existence bound for
  `documents_title_trgm_idx` / `document_chunks_content_trgm_idx`.
- Rows with the mark-applied signal (`statements IS NULL` or empty): the 2026-07-01…07-02 cluster
  (`fix_chunks_hybrid_perf_and_ambiguity`, `fix_remaining_hybrid_perf_and_ambiguity`,
  `schema_health_hybrid_execution_smoke`, `drop_dead_drifted_hybrid_variants`,
  `clinical_query_term_trgm_correction`, `commit_generation_preserve_legacy_artifacts`,
  `add_claim_ingestion_jobs_comment`, `drop_redundant_indexes`, `rag_retrieval_logs_retention`,
  `storage_cleanup_jobs_document_fk`, `fix_reset_document_index_duplicate`,
  `documents_owner_covering_index`, `fix_invoke_agent_url_to_guc`,
  `promote_index_generation_id_columns`) and the 2026-07-12 reconciliation batch
  (`reconcile_ingestion_index_shapes` … `add_legacy_index_health_batch_repair`, stmt_count 0).

**Conclusion for the two retrieval-critical indexes:** their creation was recorded as executed on
2026-07-05 (`20260705180000`, 14 statements), and both were reported missing by the live-drift
runs of 2026-08-02 (Actions 30763871562) and 2026-08-09 (31330856982), with the weekly check red
since 2026-07-26 — so the drop happened **between 2026-07-05 and 2026-08-02** (likely by
2026-07-26). No app/worker/edge-function code issues `DROP INDEX` (repo grep, this session), so a
manual/dashboard action — e.g. an accepted "unused index" advisor suggestion — is the leading
**inference, not an established attribution**; pairing with the dashboard audit/query history for
that window remains **pending** (owner action). `#248` stays open.

### 1.2 RPC divergence dossier

One entry per mismatched `match_*` function, each classified **live-ahead**, **repo-ahead**,
**normalization noise**, or **UNCLASSIFIED**, quoting the decisive diff hunk. Protected RAG
surface: an ambiguous diff is recorded as UNCLASSIFIED and escalated, never guessed.

_2026-08-14 (owner-authorized read-only connector session) — enumeration and noise-separation
complete; per-function diff hunks still pending._

All 93 `public` functions were compared by the manifest's own rule (`pg_get_functiondef`, block
and line comments stripped, whitespace stripped, md5) against `supabase/drift-manifest.json`.
Result: **0 missing on live, 0 extra on live, 16 hash mismatches** — every one a `match_document_*`
retrieval RPC.

**Six of the sixteen are normalization noise and are now closed.** A live session renders
`regprocedure` and body types unqualified (`vector`), while the manifest was generated where they
render schema-qualified (`extensions.vector`). Re-qualifying `vector` → `extensions.vector` before
hashing reproduces the manifest hash **exactly** for these six, so their bodies are byte-identical
to the repo:

| Function                                                           | Classification      | Evidence                                                             |
| ------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------- |
| `match_document_chunks(vector,integer,double precision,uuid,uuid)` | normalization noise | re-qualified hash `cdf9d685c98bc8ff731a0422c29a47a4` = manifest hash |
| `match_document_chunks_v2(vector,…,boolean)`                       | normalization noise | re-qualified hash matches manifest                                   |
| `match_document_chunks_hybrid_v2(vector,…,boolean)`                | normalization noise | re-qualified hash matches manifest                                   |
| `match_document_embedding_fields_hybrid_v2(vector,…,boolean)`      | normalization noise | re-qualified hash matches manifest                                   |
| `match_document_index_units_hybrid_scoped(vector,…,boolean)`       | normalization noise | re-qualified hash matches manifest                                   |
| `match_document_memory_cards_hybrid_v3(vector,…,boolean)`          | normalization noise | re-qualified hash matches manifest                                   |

**The remaining ten are real body differences and are UNCLASSIFIED.** They do not match the
manifest under the raw hash, the `extensions.`-stripped hash, or the re-qualified hash, so the
difference is in the body itself and not in rendering. Per the rule above they are recorded
UNCLASSIFIED rather than guessed — deciding live-ahead vs repo-ahead needs the decisive hunk:

`match_document_chunks_text`, `match_document_chunks_text_v2`, `match_document_chunks_hybrid`,
`match_document_embedding_fields_hybrid`, `match_document_index_units_hybrid`,
`match_document_index_units_hybrid_v2`, `match_document_lookup_chunks_text`,
`match_document_memory_cards_hybrid`, `match_document_memory_cards_hybrid_v2`,
`match_document_table_facts_text`.

This independently confirms the "10 retrieval RPC bodies diverge" figure in `#316` — the count is
correct, and the extra six that a naive comparison surfaces are artefacts.

**Method trap, recorded so the next run does not repeat it.** Joining manifest signatures to live
`p.oid::regprocedure::text` directly reports **all 93** functions as simultaneously missing _and_
extra, because the manifest stores `public.fn(extensions.vector,…)` and the live session renders
`fn(vector,…)`. That is a join failure, not a finding. Normalize both sides (strip the `public.`
prefix, fold `extensions.vector` → `vector`) before comparing, then test each surviving mismatch
against the qualification variants before calling it divergence.

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

**Whole-schema inventory — 2026-08-14, after the repair above (owner-authorized read-only
connector session).** The scope above is the ten `20260705180000` indexes; this is the full
`public` schema, and it is **additive to the incident, not a restatement of it**. Both repaired
indexes (`documents_title_trgm_idx`, `document_chunks_content_trgm_idx`) are confirmed **present**
on live now.

|                           Side |  Count | Source                                                                      |
| -----------------------------: | -----: | --------------------------------------------------------------------------- |
|                   Repo-defined |    210 | `supabase/drift-manifest.json` `snapshot.indexes`                           |
|                           Live |    192 | `pg_indexes`, schema `public`                                               |
|           **Absent from live** | **20** | full outer join by name                                                     |
| Orphaned on live (not in repo) |      2 | `document_table_facts_document_id_idx`, `storage_cleanup_jobs_owner_id_idx` |

210 − 20 + 2 = 192, so neither side is a partial read. The 20 absent, retrieval-relevant ones
first:

`document_chunks_anchor_idx`, `document_index_units_heading_path_idx`, `rag_aliases_type_enabled_idx`,
`rag_queries_source_chunk_ids_gin_idx`, `rag_query_misses_aliases_idx`,
`documents_registry_projection_lookup_idx`, `document_images_structured_profile_gin_idx`,
`image_caption_cache_owner_hash_idx`, `api_rate_limits_bucket_updated_idx`,
`audit_logs_action_created_idx`, `audit_logs_owner_created_idx`, `document_images_hash_idx`,
`document_images_visual_intelligence_version_idx`, `document_index_quality_owner_score_idx`,
`document_publication_approvals_document_idx`, `document_summaries_owner_idx`,
`indexing_v3_agent_jobs_locked_at_idx`, `ingestion_job_stages_job_stage_started_idx`,
`medication_records_owner_category_idx`, `storage_cleanup_jobs_owner_status_idx`.

**None is invalid-but-present.** `pg_index` filtered on `indisvalid = false or indisready = false`
returns **zero rows** across the whole `public` schema, so the failed-`CREATE INDEX CONCURRENTLY`
class documented in `docs/database-drift-detection.md` explains none of the 20. The objects are
absent, not broken.

**The creating migrations all recorded executed DDL.** Extending the §1.1 fingerprint to the four
further migrations that define these indexes — none carries the mark-applied signal:

| Migration                                              | `stmt_count` | Mark-applied? |
| ------------------------------------------------------ | -----------: | ------------- |
| `20260528007000 database_hardening_before_import`      |           32 | no            |
| `20260608001000 index_accuracy_usability_improvements` |           36 | no            |
| `20260705180000 reconcile_search_health_indexes`       |           14 | no (per §1.1) |
| `20260712165211 reconcile_missing_operational_indexes` |           27 | no            |
| `20260717170000 registry_projection_cleanup`           |           11 | no            |

So the §1.1 conclusion generalises: this is not confined to one migration or to the two repaired
indexes. Recorded-executed-but-absent now spans five migrations from 2026-05-28 to 2026-07-17,
including one named `reconcile_missing_operational_indexes`. **Root cause remains unestablished**
— §1.1's manual/dashboard-drop inference is the leading hypothesis and the dashboard audit-history
pairing is still the owner action that would confirm or refute it. This inventory widens what that
pairing has to explain; it does not by itself attribute anything.

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
- Canonical-shape validation (per PR #1960 review — `IF NOT EXISTS` could otherwise no-op on a
  same-named index; here the prior inventory proved both absent, and post-build `pg_indexes`
  returns the canonical normalized definitions verbatim):
  `CREATE INDEX document_chunks_content_trgm_idx ON public.document_chunks USING gin (lower(((COALESCE(section_heading, ''::text) || ' '::text) || COALESCE(content, ''::text))) gin_trgm_ops)` and
  `CREATE INDEX documents_title_trgm_idx ON public.documents USING gin (lower(((COALESCE(title, ''::text) || ' '::text) || COALESCE(file_name, ''::text))) gin_trgm_ops)` —
  both matching `20260705180000` / `schema.sql`.

Deviation from the phase template, recorded honestly: no PITR restore point was captured first —
the operation was additive index creation with a one-statement rollback
(`drop index concurrently`), no data-loss surface. No migration was added in the incident window:
the definitions are already codified in `20260705180000` + `schema.sql`, and this was the
documented operator prebuild for a drifted hosted target. **Outstanding phase debt (PR #1960
review):** plan phase 4.4 still requires a fail-fast reconcile/guard migration for this repaired
pair (the `20260804110240` pattern names four other indexes only), so a later replay cannot
silently proceed if either index disappears again — queued as follow-up work for the full Phase 4
batch, deliberately not bundled into this docs-only PR because migrations are an operational-risk
surface with their own replay gates. The other 19 drift findings, the 2 unexpected live indexes,
and the green live-drift dispatch also remain **pending** for the full phase.

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

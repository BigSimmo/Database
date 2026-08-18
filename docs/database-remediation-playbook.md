# Database remediation playbook — multi-session execution guide

Companion to [`database-remediation-plan.md`](database-remediation-plan.md) (the plan of record —
read it first in every session). This playbook exists so the work can be executed across **many
separate chat sessions**: each phase below carries the full context a fresh session needs and a
ready-to-paste prompt. Tracking anchor: ledger `#312` (P1). Update it as phases complete.

---

## Context briefing (paste-adjacent background every session can rely on)

**What happened.** Investigation of ledger `#248` (closed 2026-08-13) proved that migration
`20260705180000_reconcile_search_health_indexes.sql` was recorded as applied on the live Supabase
project (`Clinical KB Database`, ref `sjrfecxgysukkwxsowpy`) **without its DDL ever executing**.
The history row was recorded out-of-band (mark-applied/repair). Evidence: Supabase wraps each
migration in one transaction (partial persistence impossible); later 2026-07-06 migrations are
behaviorally live, requiring that history row to pre-exist; and two of its indexes are still
missing on live today. This is systemic, not one-off.

**Current live state** (from scheduled `live-drift.yml` Actions run `31330856982`, 2026-08-09):

- 21 `missing_live` indexes across many migrations — tables: `audit_logs` (2), `api_rate_limits`,
  `document_chunks` (2, incl. `document_chunks_content_trgm_idx`), `document_images` (3),
  `document_index_quality`, `document_index_units`, `document_publication_approvals`,
  `document_summaries`, `documents` (2, incl. `documents_title_trgm_idx`),
  `image_caption_cache`, `indexing_v3_agent_jobs`, `ingestion_job_stages`, `medication_records`,
  `rag_aliases`, `rag_queries`, `rag_query_misses`, `storage_cleanup_jobs`.
- 2 `unexpected_live` indexes: `document_table_facts_document_id_idx`,
  `storage_cleanup_jobs_owner_id_idx`.
- `def_hash` mismatches on 10 `match_*` retrieval RPCs (protected RAG surface; live bodies vs
  repo — direction unknown until diffed).
- The weekly `live-drift` run has been red since 2026-07-26 with no notification routing.

**Prior repair to imitate.** PR #1614 / migration `20260804110240_restore_rag_search_health_indexes.sql`
is the approved pattern: operator prebuilds indexes with `CREATE INDEX CONCURRENTLY` outside any
transaction, validates `pg_index.indisvalid AND indisready` plus normalized `pg_get_indexdef`
against a pinned canonical definition, and only then marks a fail-fast guard migration applied.

**Key repo facts every session needs:**

- Repo: `BigSimmo/Database`, default branch `main`. Live Supabase ref `sjrfecxgysukkwxsowpy`
  (the ref `qjgitjyhxrwxsrydablr` is stale — never use). Migrations target role `postgres`.
- `supabase/migrations/` is the source of truth; `supabase/schema.sql` is a mirror;
  `supabase/drift-manifest.json` is generated (`npm run drift:manifest`, needs Docker) and
  sha-pinned to `schema.sql`.
- `check:drift` compares live (`public.schema_drift_snapshot()` RPC, service-role only) against
  the manifest. `search_schema_health()` is the runtime probe; its `required_indexes` list lives
  inside the function and is changed only by migration, never by editing `schema.sql`.
- Ledger: `docs/outstanding-issues.md`, mutated only via `npm run issues:add|update|done`.
- AGENTS.md rules that bind here: provider confirmation boundary (no OpenAI/Supabase/CI calls
  without explicit user approval); RAG ranking protection (flag before touching `match_*` RPCs or
  `src/lib/rag/**`; behaviour changes need a live eval-canary pair 36/36 / recall 1.0); run
  `npm run format` and commit before every push; `npm run check:migration-role` after Supabase SQL
  changes; PR bodies are parsed input (`RAG impact:` line, Clinical Governance Preflight).
- Related open ledger rows: `#312` (anchor), `#102` (canary-gated documents index debt — do NOT
  fold into the restore), `#231` (latency budget binding — trigram-index hypothesis), `#056`/`#057`
  (staging parity, soak), `#011` (pool allocation), `#036` (public-corpus marker), `#022` (BMJ
  attestation apply), `#025` (webhook inert), `#183` (missing SUPABASE_ACCESS_TOKEN),
  `#188`/`#196`–`#200` (DR gaps), `#191` (ACL consolidation — last), `#098`/`#099` (round trips).

**Session hygiene for every phase:** start from a fresh worktree off latest `origin/main`
(`newtask` skill), one branch per phase (`claude/db-remediation-phase-N`), record evidence in
`docs/audit/live-drift-forensics-2026-08.md`, hand off via the `handoff` skill, and update `#312`
via `npm run issues:update` before the session ends.

**Model guidance:** Fable for Phases 1, 3, 6 (and #191 later) — judgment-heavy, expensive
mistakes. Opus is sufficient for Phases 0, 2, 4, 5, 7 — execution against this playbook.

---

## Phase 0 — Enablement (repo-only; no approval window needed) · Opus · 2–4 h

Deliverables: drift-failure routing, post-migration drift trigger, evidence file scaffold.
Definition of done: PR merged; `check:github-actions` and `verify:pr-local` green; a forced
`workflow_dispatch` failure produces/updates the pinned issue.

**Prompt to paste:**

> Read docs/database-remediation-plan.md and docs/database-remediation-playbook.md, then execute
> Phase 0 only. On a fresh branch off origin/main: (1) extend .github/workflows/live-drift.yml so
> a failed run creates or updates a single pinned GitHub issue titled "Live drift check failing",
> body containing the drift finding lines from the run log and the run URL, and so the next green
> run comments resolution on that issue — use a SHA-pinned actions/github-script step consistent
> with this repo's pinning policy and the least permissions that work (issues: write on that job
> only); (2) add a trigger so live-drift also runs on push to main when supabase/migrations/** or
> supabase/schema.sql changed; keep schedule + workflow_dispatch; keep concurrency
> cancel-in-progress: false; (3) create docs/audit/live-drift-forensics-2026-08.md with headed
> empty sections for Phases 1–5 evidence; (4) do NOT touch any Supabase code or call any provider.
> Run npm run check:github-actions and npm run verify:pr-local, run npm run format and commit it,
> push, open a PR (no RAG impact line needed — no RAG surface touched), and update ledger #312 via
> npm run issues:update noting Phase 0 delivered. Do not watch the PR after opening it.

Note for the operator (not the model): adding `SUPABASE_ACCESS_TOKEN` to environment secrets
(`#183`) is dashboard work you do yourself; never paste token values into a chat.

## Phase 1 — Read-only forensics (approved read-only window) · Fable · 1–2 h

Deliverables: migration-history fingerprint list, RPC divergence dossier (10 diffs classified),
index sizing + `EXPLAIN` baselines. Definition of done: all three recorded in the forensics doc;
`#312` updated with the named mark-applied version list; no writes performed.

**Prompt to paste:**

> Read docs/database-remediation-plan.md and docs/database-remediation-playbook.md. I authorize a
> READ-ONLY window against the live Supabase project Clinical KB Database
> (sjrfecxgysukkwxsowpy) for Phase 1. Absolutely no INSERT/UPDATE/DELETE/DDL — SELECT and EXPLAIN
> only; stop and report if any step would write. Execute: (1) run the migration-history
> fingerprint query from the plan (statements IS NULL over supabase_migrations.schema_migrations)
> and list every no-statements version with its name; (2) for each of the 10 match_* RPCs named in
> the 2026-08-09 live-drift log, fetch pg_get_functiondef from live and diff against the repo's
> canonical body (search supabase/migrations for the latest create-or-replace of each), then
> classify each as live-ahead, repo-ahead, or normalization noise, quoting the decisive diff hunks
> — this is a protected RAG surface, so classification accuracy matters more than speed, and any
> ambiguous diff is recorded as UNCLASSIFIED with the ambiguity explained, never guessed; (3) for
> the 21 missing and 2 unexpected indexes, record owning-table pg_relation_size and run EXPLAIN
> (ANALYZE, BUFFERS) for the documents title ILIKE query, the document_chunks content search, and
> the rag_retrieval_logs miss scan as before-baselines. Write all evidence with dates and run IDs
> into docs/audit/live-drift-forensics-2026-08.md, update ledger #312, commit, push, PR (docs-only;
> RAG impact line not required since no RAG code changed — but state in the PR body that RPC diffs
> were read and classified). Do not fix anything in this phase.

## Phase 2 — Staging parity rehearsal (approved staging window) · Opus · 2–4 h

Deliverables: staging at full migration parity; `check:drift` green against staging.
Definition of done: pasted replay output + green drift line in the forensics doc; `#056` updated.

**Prompt to paste:**

> Read docs/database-remediation-plan.md and docs/database-remediation-playbook.md. I authorize
> mutation of the STAGING Supabase tier (Clinical KB Staging) only — production
> (sjrfecxgysukkwxsowpy) remains read-only and must not be targeted; verify the target ref before
> every command and abort if it resolves to production. Execute Phase 2: replay the full committed
> migration chain onto staging to parity (staging is idle, so guard migrations like 20260804110240
> may need their indexes built first — build them transactionally or concurrently there, then
> proceed), then run check:drift against staging and get it green. Record the replay tail, any
> migration that misbehaved on clean replay (that is a finding — capture it), and the green drift
> output in docs/audit/live-drift-forensics-2026-08.md. Update ledger #056 and #312, commit, push,
> PR. If any migration fails on clean replay, stop, record, and report rather than patching live
> objects by hand.

## Phase 3 — RPC reconciliation (approved production window; canary approvals per repo-ahead RPC) · Fable · 2–6 h

Prerequisite: Phase 1 dossier. Deliverables: every mismatched RPC codified or reconciled.
Definition of done: zero function `def_hash` mismatches on the next live-drift run (or reasoned
allowlist entries); eval evidence attached for any behaviour-changing deploy.

**Prompt to paste:**

> Read docs/database-remediation-plan.md, docs/database-remediation-playbook.md, and the Phase 1
> RPC dossier in docs/audit/live-drift-forensics-2026-08.md. Flag now, before editing: this task
> touches protected RAG retrieval RPCs. I authorize Phase 3 against production
> (sjrfecxgysukkwxsowpy) per the dossier's classifications: for normalization-noise entries, fix
> the manifest/normalizer side only and regenerate; for live-ahead entries, author migrations that
> codify the live body verbatim plus the schema.sql mirror and regenerated drift-manifest, PR body
> carrying "RAG impact: no retrieval behaviour change — codifying already-live body" with the diff
> as evidence; for repo-ahead entries, STOP and list them with their behavioural delta — each
> needs my separate explicit approval and a live eval-canary pair (baseline then post, 36/36
> retrieval cases, recall 1.0, zero per-case rr regressions) around its deploy, one revertible
> migration each. Any UNCLASSIFIED entry stays untouched and is escalated to me. Run npm run
> check:migration-role and tests/supabase-schema.test.ts, format, commit, push, PR with the full
> Clinical Governance Preflight. Update #312 with per-RPC outcomes.

## Phase 4 — Index restoration (approved off-peak production window) · Opus · 2–3 h active

Prerequisites: Phases 1–3. Deliverables: 21 indexes restored + validated, 2 unexpected indexes
dispositioned, guard migrations landed, live-drift green. Definition of done: green live-drift
dispatch output pasted; `search_schema_health()` still `ok: true`.

**Prompt to paste:**

> Read docs/database-remediation-plan.md and docs/database-remediation-playbook.md plus the Phase
> 1 sizing table. I authorize Phase 4 DDL against production (sjrfecxgysukkwxsowpy) in this
> off-peak window. Procedure, exactly: capture/confirm a PITR restore point first; then for Batch
> A (small tables) and Batch B (large tables, one at a time) run CREATE INDEX CONCURRENTLY IF NOT
> EXISTS with the canonical definitions from the repo migrations, after each build verify
> pg_index.indisvalid AND indisready and DROP INDEX CONCURRENTLY + retry any invalid build; hold
> the two #102-adjacent bare-column indexes out entirely — restore only the canonical
> 20260705180000 trigram definitions; disposition the 2 unexpected_live indexes per the plan
> (codify or DROP INDEX CONCURRENTLY if redundant — state which and why). Then author one
> fail-fast guard migration per batch following 20260804110240 exactly (validates, never builds),
> mirror into schema.sql, npm run drift:manifest, extend search_schema_health() required_indexes
> via migration for indexes the runtime should monitor, run check:migration-role and the supabase
> schema tests, format, commit, push, PR ("RAG impact: no retrieval behaviour change — restoring
> already-recorded canonical index definitions; ordering-affecting surfaces untouched"), full
> governance preflight. Finally dispatch the live-drift workflow and paste its green output into
> docs/audit/live-drift-forensics-2026-08.md. Update #312. If any single build repeatedly fails or
> locks, skip it, record it, continue the batch, and report — never fall back to a transactional
> build on production.

## Phase 5 — Measure and close the loop (read-only + optional eval; ~$1–2 if RPCs changed) · Opus · 1–2 h

Deliverables: after-EXPLAINs, `#231` re-test, readiness check. Definition of done: before/after
table in the forensics doc; `#231` updated with data; `check:production-readiness` output recorded.

**Prompt to paste:**

> Read docs/database-remediation-plan.md, docs/database-remediation-playbook.md, and the Phase 1
> baselines. I authorize a read-only production window plus npm run check:production-readiness
> (and eval:retrieval:quality ONLY if Phase 3 deployed a behaviour-changing RPC — ask me first if
> unsure). Re-run the Phase 1.3 EXPLAIN (ANALYZE, BUFFERS) set and build a before/after table
> showing plan changes and timings; then assess ledger #231: with the trigram indexes present,
> exercise the answer path's retrieval timing and state with evidence whether the 25s fast-route
> budget still binds — update #231 accordingly (close, re-scope, or confirm still open). Record
> everything in docs/audit/live-drift-forensics-2026-08.md, update #312, commit, push, PR.

## Phase 6 — Future-proofing (repo + one migration deploy) · Fable · 4–6 h

Deliverables: history-integrity probe, guard-migration contract + enforcing test, monitoring
ratchet. Definition of done: `check:drift` reports unguarded `statements IS NULL` versions; repo
test fails on an allowlisted version without a guard file; docs updated; migration deployed.

**Prompt to paste:**

> Read docs/database-remediation-plan.md and docs/database-remediation-playbook.md, then execute
> Phase 6. Design first, then build: (1) a migration extending public.schema_drift_snapshot() to
> also return supabase_migrations.schema_migrations versions whose statements IS NULL, and a
> check-drift change reporting any such version absent from a new reviewed allowlist
> (supabase/drift-allowlist.json style — every entry needs a reason and a pointer to its guard
> migration); think about how this could false-positive (legitimate repairs, squashed baselines)
> and make the allowlist expressive enough to stay honest without being a rubber stamp; (2) a
> documented guard-migration contract in docs/database-drift-detection.md and an AGENTS.md note:
> any mark-applied/history repair MUST ship a fail-fast validation migration per 20260804110240,
> plus a repo test asserting every allowlisted no-statements version has a matching guard
> migration file; (3) a repo test ratcheting index monitoring: every index defined by migrations
> on retrieval-critical tables (documents, document_chunks, document_index_units,
> document_embedding_fields, document_memory_cards, rag_retrieval_logs) is either in
> search_schema_health() required_indexes or in an explicit unmonitored list with reasons. Deploy
> only the snapshot migration to production with my approval when the PR is ready — everything
> else is repo-side. Run check:migration-role, the supabase schema tests, verify:pr-local; format,
> commit, push, PR with governance preflight and "RAG impact: no retrieval behaviour change —
> observability-only snapshot extension". Update #312 and capture any residuals via /issues.

## Phase 7 — Deferred debt (each its own session)

Run each as an independent task when its trigger arrives; none blocks the phases above.

- `#022` BMJ attestation hosted apply — Opus; needs its own approved window + human review step.
- `#025` Railway webhook configuration — operator dashboard + Opus verification session.
- `#036` explicit public-corpus marker migration — Opus, with supabase-schema-guardian review.
- `#191` ACL-migration consolidation — **Fable**, only after Phase 6 is live; prompt should
  require proving RLS/owner-scope equivalence before and after consolidation.
- `#196`–`#200` DR codification + `#057` soak/rollback drill — Opus, following
  docs/operator-backlog.md; verify with names-only output.
- `#098`/`#099` round-trip budget tests — Opus, repo-only.
- `#011` pool allocation + `#200` dashboard settings — operator dashboard work, no model needed.

---

## Cross-session tracking

After every phase: update `#312` (`npm run issues:update`), append evidence to
`docs/audit/live-drift-forensics-2026-08.md`, and record the phase's PR in the normal ledger flow.
If a session dies mid-phase, the next session re-reads this playbook, the forensics doc, and
`#312`, and resumes from the last recorded evidence — nothing lives only in chat.

---

## Appendix — exact drift inventory (from live-drift Actions run 31330856982, 2026-08-09)

Recorded here so no session has to re-fetch the Actions logs. Re-verify against the latest run
before Phase 4 — this is the 2026-08-09 snapshot, not a live query.

**21 `missing_live` indexes:**

| Index                                             | Table                            |
| ------------------------------------------------- | -------------------------------- |
| `api_rate_limits_bucket_updated_idx`              | `api_rate_limits`                |
| `audit_logs_action_created_idx`                   | `audit_logs`                     |
| `audit_logs_owner_created_idx`                    | `audit_logs`                     |
| `document_chunks_anchor_idx`                      | `document_chunks`                |
| `document_chunks_content_trgm_idx`                | `document_chunks`                |
| `document_images_hash_idx`                        | `document_images`                |
| `document_images_structured_profile_gin_idx`      | `document_images`                |
| `document_images_visual_intelligence_version_idx` | `document_images`                |
| `document_index_quality_owner_score_idx`          | `document_index_quality`         |
| `document_index_units_heading_path_idx`           | `document_index_units`           |
| `document_publication_approvals_document_idx`     | `document_publication_approvals` |
| `document_summaries_owner_idx`                    | `document_summaries`             |
| `documents_registry_projection_lookup_idx`        | `documents`                      |
| `documents_title_trgm_idx`                        | `documents`                      |
| `image_caption_cache_owner_hash_idx`              | `image_caption_cache`            |
| `indexing_v3_agent_jobs_locked_at_idx`            | `indexing_v3_agent_jobs`         |
| `ingestion_job_stages_job_stage_started_idx`      | `ingestion_job_stages`           |
| `medication_records_owner_category_idx`           | `medication_records`             |
| `rag_aliases_type_enabled_idx`                    | `rag_aliases`                    |
| `rag_queries_source_chunk_ids_gin_idx`            | `rag_queries`                    |
| `rag_query_misses_aliases_idx`                    | `rag_query_misses`               |

**2 `unexpected_live` indexes:** `document_table_facts_document_id_idx`,
`storage_cleanup_jobs_owner_id_idx`.

**10 `match_*` RPCs with `def_hash` mismatches (Phase 1.2 / Phase 3 targets):**
`match_document_chunks_hybrid`, `match_document_chunks_text`, `match_document_chunks_text_v2`,
`match_document_embedding_fields_hybrid`, `match_document_index_units_hybrid`,
`match_document_index_units_hybrid_v2`, `match_document_lookup_chunks_text`,
`match_document_memory_cards_hybrid`, `match_document_memory_cards_hybrid_v2`,
`match_document_table_facts_text`.

**Already repaired 2026-08-04 (PR #1614 — do not re-restore):**
`document_labels_label_trgm_idx`, `document_summaries_summary_trgm_idx`,
`document_index_units_owner_chunk_type_idx`, `rag_retrieval_logs_miss_idx`.

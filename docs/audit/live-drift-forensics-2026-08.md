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

_Not yet run. Requires an approved read-only production window._

### 1.1 Migration-history fingerprint

_Pending._ Record every `statements IS NULL` version with its name, and state explicitly whether
`20260705180000` carries that signal — then pair it with audit history to distinguish a
mark-applied/repair history from indexes that were created and later dropped. Do not close `#248`
on the fingerprint alone.

### 1.2 RPC divergence dossier

_Pending._ One entry per mismatched `match_*` function, each classified **live-ahead**,
**repo-ahead**, **normalization noise**, or **UNCLASSIFIED**, quoting the decisive diff hunk.
Protected RAG surface: an ambiguous diff is recorded as UNCLASSIFIED and escalated, never guessed.

### 1.3 Index inventory, sizing, and EXPLAIN baselines

_Pending._ Owning-table `pg_relation_size` for the 21 missing and 2 unexpected indexes, plus
`EXPLAIN (ANALYZE, BUFFERS)` baselines for the `documents` title ILIKE query, the `document_chunks`
content search, and the `rag_retrieval_logs` miss scan. These are the before-measurements for
Phases 4 and 5.

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

_Not yet run. Requires an approved off-peak production window._

_Pending._ PITR restore point, per-index `CREATE INDEX CONCURRENTLY` result with its
`indisvalid`/`indisready` verification, disposition of the 2 unexpected live indexes with reasons,
the guard migrations landed, and the green live-drift dispatch output.

## Phase 5 — Measure and close the loop

_Not yet run. Requires a read-only production window (plus eval approval only if Phase 3 changed
behaviour)._

_Pending._ Before/after `EXPLAIN` table against the Phase 1.3 baselines showing plan flips and
timings, the evidence-backed verdict on ledger `#231`'s 25 s fast-route budget, and the
`check:production-readiness` output.

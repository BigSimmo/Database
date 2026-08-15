# Edge Ingestion Overhaul — 3-PR Execution Plan

**Status:** planned, nothing built. Base commit for PR 1: a fresh `origin/main`
(plan written against `af773a7e3`).
**Owner context:** clinical KB (`psychiatry.tools`); live Supabase `Clinical KB
Database` (`sjrfecxgysukkwxsowpy`); Railway app + container worker. Every live /
provider action is approval-gated per `AGENTS.md`.
**Why:** the edge enrichment pipeline produces heuristic "summaries" (truncated
text slices), the recovered-from-live `ingestion-worker` edge function can
complete never-indexed documents, and the real LLM summary pipeline
(`src/lib/document-enrichment.ts`) is not wired into any automated path.

## Cross-chat continuity rules (read first)

1. Each PR starts from a fresh `origin/main` base; never pile onto a stale head.
2. One build agent touches the hot file per PR
   (`supabase/functions/indexing-v3-agent/index.ts`). Parallel agents only on
   disjoint files (docs, tests, scripts).
3. Every PR: `npm run format` **and commit the result** before push; run
   `verify:pr-local`; PR body must carry the complete
   `## Clinical Governance Preflight` from `.github/pull_request_template.md`
   plus the exact `RAG impact:` line given per PR below, written in full prose
   (it is parsed by `scripts/pr-policy.mjs` — a shortened fragment fails the
   gate).
4. **RAG flag (AGENTS.md):** these changes alter retrieval *inputs* — summary
   text/embeddings and labels feed hybrid search
   (`src/lib/rag/rag-contracts.ts:134`). PR 1 = "no retrieval behaviour
   change"; PR 2 = "behaviour change — canary pair". No ranking code changes.
5. Never execute without explicit user approval: live migrations, edge
   function deploys, dashboard cron edits, backfill runs (OpenAI spend),
   canary evals, `check:supabase-project`, or Supabase reads. Report the exact
   command and ask.
6. After a PR opens: stop (repo policy — no babysitting CI). Record the review
   via `npm run ledger:append`.
7. Resume checklist for another chat: PR number, branch, last commit SHA, next
   step, gates run with decisive output lines, and open approval items.

---

## PR 1 — Phase 0: P1 fixes + retire `ingestion-worker`

**Branch:** `codex/edge-ingestion-retire-p1`.
**Class:** fail-safe removal + correctness.
**Estimate:** ~2.5–3.5 h build; ~0.5 day wall-clock with review/CI.

### Changes

1. **Delete** `supabase/functions/ingestion-worker/index.ts` and
   `supabase/functions/ingestion-worker/auth.ts` (whole directory).
2. **`supabase/config.toml`:** remove the `[functions.ingestion-worker]` /
   `verify_jwt = true` block; keep `[functions.indexing-v3-agent] verify_jwt = false`.
3. **New migration** `supabase/migrations/<timestamp>_retire_ingestion_worker.sql`:
   - `drop function if exists public.invoke_ingestion_worker(integer);`
   - Header comment: the dashboard pg_cron job calling this function must be
     removed by an operator **before/with** application (operator step —
     approval-gated). The drop is idempotent.
4. **Mirror in `supabase/schema.sql`:** remove the `invoke_ingestion_worker`
   definition, its `revoke execute … / grant execute …` pair, and the
   `ALTER DATABASE SET app.ingestion_worker_base_url` block (currently around
   lines 3455–3510).
5. **`supabase/functions/indexing-v3-agent/index.ts` fixes (same PR):**
   - **Committed-generation filter** on all three `document_chunks` queries:
     `ensureSummary` (`:573-579`), the labels chunk query (`:792-798`), and
     `ensureSectionsFromChunks` (`:1018-1024`). Add:
     `and (c.index_generation_id is null or c.index_generation_id = (select (metadata->>'index_generation_id')::uuid from public.documents where id = $docId))`
     — the `is null` arm keeps legacy always-visible rows so legacy docs do not
     lose their summaries.
   - **Batch isolation (R24b):** in the serve loop (`:1939-1954`), wrap
     `await markJobFailure(job, msg)` in its own `try/catch` so a status-RPC
     failure cannot abandon the remaining claimed jobs.
   - **Retry backoff alignment:** resolves by deletion — the misaligned fixed
     60 s backoff lived in the retired `ingestion-worker`; the agent already
     uses the `INDEXING_V3_RETRY_DELAY_MS` ladder via `behavior.ts`.
6. **Docs sweep** (grep first, then edit): `docs/codebase-index.md`
   (edge-function table / config.toml note), `docs/deployment-architecture.md`
   §3 (edge role is `indexing-v3-agent` only),
   `docs/disaster-recovery-runbook.md` (~line 107–114: pg_cron invoked-function
   list + edge-function redeploy list), `docs/ingestion-state-machine.md` §2
   writers (add a retirement note for the recovered-from-live worker).
7. **Tests:** grep `tests/` and `scripts/` for `ingestion-worker` /
   `invoke_ingestion_worker`; update `tests/supabase-schema.test.ts` only if it
   pins the function; add an assertion that `invoke_ingestion_worker` is absent
   from `schema.sql` (prevents resurrection).

### Gates (run and record decisive output)

| Gate | Why |
|---|---|
| `npm run check:edge:functions` | Deno v2 typecheck of the remaining agent (needs Deno v2 locally; CI enforces) |
| `npm run check:indexing` | ingestion-surface health |
| `npm run test:focused -- --files tests/supabase-schema.test.ts` | schema contract |
| `npm run check:migration-role` | **required** — Supabase SQL changed |
| `npm run verify:pr-local` | PR handoff gate |
| `npm run check:production-readiness` | ingestion/privacy domain rule |

**PR body:** complete `## Clinical Governance Preflight` (all items) plus:
`RAG impact: no retrieval behaviour change — removes the backfill edge worker
and adds claim/query generation guards only; no ranking or retrieval inputs
change in this PR.`

### Approval gates (operator; report + ask)
1. Apply `<timestamp>_retire_ingestion_worker.sql` to live (pause, confirm, per
   migration safety rules).
2. Remove the dashboard pg_cron schedule for `invoke_ingestion_worker` (if
   present — confirm first; if it is **still active**, this is urgent: it may
   be completing unindexed documents right now).
3. Deploy the updated `indexing-v3-agent`.

**Rollback:** restore the deleted files, revert config/schema, re-deploy the
previous agent version. The DB drop is inert if the cron is removed first.

---

## PR 2 — Phase 1: Real AI summaries in `indexing-v3-agent`

**Branch:** `codex/edge-ingestion-ai-summary`.
**Class:** behaviour change (retrieval inputs).
**Estimate:** ~5–7 h build; ~1–1.5 days wall-clock including canary.

### Design (locked)

- Replace `ensureSummary` (`index.ts:564-607`) with an OpenAI structured-output
  summary mirroring `src/lib/document-enrichment.ts`'s `summarySchema`:
  `summary` (string), `clinical_specifics.profile` with source-anchored items
  (`text` + `source_chunk_ids` + `evidence_type` + `support`), `labels[]`.
- **Coverage-aware chunk selection:** Deno port of
  `selectCoverageAwarePromptChunks` (first/middle/last + section-diverse, char
  budget ~8–10 k) — never first-N-only.
- Call `POST https://api.openai.com/v1/chat/completions` with
  `response_format: json_schema`; reuse the `OPENAI_REQUEST_TIMEOUT_MS` /
  `OPENAI_MAX_RETRIES` / non-retryable-4xx fast-fail patterns from
  `fetchEmbeddingBatch` (`:249-309`). Model: `OPENAI_INDEXING_MODEL` env
  (default `gpt-5.6-terra`), `maxOutputTokens` 2400.
- **Runtime validation:** assert object shape, non-empty summary, labels array,
  finite lengths (mirror `parseGeneratedSummary`).
- **Fallback:** on failure keep the existing heuristic but with
  `model:'heuristic-fallback'` + `metadata.reason` — never claim LLM success.
- **Regeneration semantics:** replace the early-return (`:571`) — skip only
  when the stored row has `metadata->>'summary_kind' = 'llm'` AND
  `summary_version = 'v1'` AND a non-null summary; otherwise regenerate
  (covers heuristic rows, empty rows, reindexed content).
- **Markers on upsert:** `model` = actual LLM model;
  `metadata = { generated_by:'indexing-v3-agent', summary_kind:'llm',
  summary_version:'v1', index_generation_id: <committed gen>, generated_at }`.
- **Stage-then-swap:** generate + validate fully before any DB write; upsert
  only (`on conflict document_id do update`); never delete-before-generate
  (R24a).
- **Embedding:** `upsertCoreEmbeddingFields` embeds the new summary with the
  existing `text-embedding-3-small` + `assertEmbeddingDim` — gte-small
  divergence disappears with PR 1's deletion.
- **Contract test:** extract the JSON schema into
  `supabase/functions/indexing-v3-agent/summary-schema.ts`; add
  `tests/edge-summary-schema.test.ts` (reads/validates the schema keys — same
  pattern as `tests/supabase-schema.test.ts` reads SQL) so vitest pins the
  contract even though the Deno runtime has no local unit harness.
- **Backfill (operator-run, approval-gated):** extend
  `scripts/enrich-documents.ts` with a filter for rows whose `model` matches
  heuristic markers (`gte-small-heuristic-summary-v1`, `v3-summary-heuristic`);
  dry-run first, then batched live run (~2000 legacy rows — OpenAI spend,
  explicit approval). Confirm first whether live rows are dim-compatible (the
  backfill overwrites embeddings with 1536-dim).

### Gates

`npm run check:edge:functions` · `npm run check:indexing` ·
`npm run test:focused -- --files tests/edge-summary-schema.test.ts,tests/document-enrichment.test.ts` ·
`npm run verify:pr-local` · `npm run check:production-readiness`.

**PR body:** complete Clinical Governance Preflight plus:
`RAG impact: behaviour change — canary pair <baseline commit/state> -> <post-change>`
(document summaries and their embeddings feed hybrid retrieval; the canary must
pin doc/content recall 1.0 and zero per-case rr regressions).

### Approval gates
1. Deploy the agent (operator).
2. Offline golden check first (`npm run eval:retrieval` local/offline fixtures),
   then **live eval-canary pair** before trusting (provider-backed, ~$1–2,
   explicit approval).
3. Backfill run (explicit approval).
4. Rollout strategy: ship with heuristic-fallback intact; canary on a document
   sample before the full fleet.

**Rollback:** re-deploy previous agent version (writes are idempotent upserts;
heuristic rows unchanged). Canary regression → single-commit revert +
confirmation run.

---

## PR 3 — Phase 2 + 3: Edge-loop hardening, quality gates, docs

**Branch:** `codex/edge-ingestion-hardening`.
**Class:** hardening/quality (no retrieval behaviour change).
**Estimate:** ~3–4 h build; ~0.5–1 day wall-clock.

### Changes

1. **Lease heartbeat + lock-holder fencing (R1/R2 class):** migration
   `<ts>_agent_lease_heartbeat_and_fencing.sql` — extend
   `update_indexing_v3_agent_job_status` (and the agent's status writes) to
   accept `p_worker_id` and fence on `locked_by`; the agent refreshes
   `locked_at` mid-run guarded by its own worker id. Mirror in `schema.sql`.
   Matters once LLM latency makes a 45-min double-claim realistic.
2. **Re-open path for `needs_enrichment_artifacts` (R24a/R24d):** migration
   letting claim accept that status when `metadata` carries an explicit repair
   marker (`repair_requested_at`); wire `repair_strict_enrichment_gate_batch`
   into an ops path (`scripts/check-indexing.ts` or a small new script) with a
   dry-run.
3. **Schema↔live re-sync (R24e):** reconcile `ingestion_job_stages.job_id` FK
   (drop or repoint) and the claim-RPC seed-insert + `d.status='indexed'` join
   into `schema.sql` so fresh environments match live.
4. **`scripts/check-indexing.ts` extension:** assert every document has a
   summary row carrying `model`/`summary_kind` markers; count heuristic rows;
   flag truncation tails (`...$`) and summaries lacking `source_chunk_ids`;
   fail closed on new heuristic-only rows after rollout.
5. **Docs:** `docs/ingestion-state-machine.md` — new summary lifecycle states
   (heuristic → llm, version marker, regeneration rules); strike the phase-3
   backlog items this closes; update `docs/deployment-architecture.md` /
   `worker-deploy-runbook.md` if the heartbeat changes operator guidance.

### Gates

`npm run check:migration-role` · `npm run check:edge:functions` ·
`npm run check:indexing` · focused vitest (schema + check-indexing tests) ·
`npm run verify:cheap` (cross-cutting SQL/scripts) ·
`npm run check:production-readiness`.

**PR body:** Clinical Governance Preflight +
`RAG impact: no retrieval behaviour change — lease/repair/schema-sync
hardening and offline quality assertions only.`

### Approval gates
Apply the two migrations to live (operator, paused and confirmed); re-deploy
the agent if its status-write signature changed.

**Rollback:** migrations are additive/fencing-only; roll back the deploy; the
check-script assertions can be relaxed to warnings.

---

## Definition of done (whole programme)

1. `ingestion-worker` gone from repo, config, schema, docs, live function list,
   and live cron.
2. New/regenerated summaries are LLM-generated with `summary_kind='llm'`,
   versioned, anchored, and generation-aware; heuristic exists only as an
   explicitly labelled fallback.
3. Legacy heuristic rows backfilled (or tracked as a known, counted remainder).
4. Canary pair green; `check:indexing` fails closed on summary-quality
   regressions.
5. Heartbeat/fencing, re-open path, and schema sync live; state-machine doc
   reflects the new truth.

## Residual risks (honest)

- **Unverified live facts:** whether the `invoke_ingestion_worker` cron is still
  active, and the live `document_embedding_fields.embedding` dimension vs
  gte-small rows — both need one approval-gated Supabase read before/at PR 1
  handoff.
- Deno v2 availability on the local Windows box; if absent,
  `check:edge:functions` warns locally and CI carries the gate.
- PR 2's canary and backfill cost real money and operator time — they sit on
  the critical path and cannot be parallelized away.

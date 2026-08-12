# RAG remediation plan handover — 2026-08-12

## Purpose

This handover preserves the useful context and decisions from the RAG audit, remediation-plan,
Codex Cloud-readiness, and current-repository reconciliation conversation. It is intended to let a
fresh task continue safely without repeating completed work or treating historical findings as
current defects.

This document records a plan and evidence review only. It does not authorize provider calls,
production access, hosted mutations, Git publishing, deployment, or spending.

## Current request and intended outcome

The user wants one perfected, correctly ordered plan that:

- covers the full RAG lifecycle: content organization and ingestion, retrieval, ranking, evidence
  selection, generation, fallbacks, citations, output formatting, latency, efficiency, evaluation,
  governance, and release safety;
- incorporates every still-useful item from the earlier audit/remediation plan;
- removes work already completed or refuted by current evidence;
- explicitly completes the useful residuals of tasks `#098` and `#100`;
- can be divided into provider-free Cloud work and separately approved provider/operator work; and
- preserves the repository's protected-RAG and clinical-safety contracts.

## Evidence basis and freshness

Repository comparison was read-only and used the locally available remote-tracking snapshot:

- `refs/remotes/origin/main`: `bc00419f83de1a59d9413b9ecf0827775c83e070`
- commit date: 2026-08-12
- subject: `Merge pull request #1833 from BigSimmo/cursor/privacy-quiet-signal-adopt-bc81`

No fresh fetch was performed during the plan review. Revalidate `origin/main`, open PR overlap, the
task ledger, and relevant provider state before implementation.

Primary repository evidence inspected:

- `docs/outstanding-issues.md`
- `docs/rag-hybrid-findings-and-todo.md`
- `docs/search-rag-master-plan.md`
- `docs/maturity-backlog-workorders.md`
- `docs/verified-answer-incremental-delivery-design.md`
- `docs/audit/latency-audit-2026-07-28.md`
- `docs/evidence/rag-reliability-evidence-2026-07-27.md`
- `docs/rag-behaviour/`
- current `src/lib/rag/`, answer/search routes, evaluation scripts, and focused RAG tests

## Checkout safety state

The checkout used for review is not suitable for RAG implementation:

- branch: `test-main-lighthouse`
- HEAD: `8d3938e574e430727068c251e1e6493ec4026764`
- relationship reported at handover creation: ahead of its upstream by 1 and behind by 351
- many unrelated modified files, temporary artifacts, retained worktrees, and diagnostic files are
  present

Preserve all of that work. Do not reset, clean, stash, rebase, delete, absorb, or commit unrelated
changes. Start implementation in a clean isolated worktree based on a freshly fetched and verified
`origin/main`.

## Repository findings that supersede the old plan

### Completed work to remove from the active remediation queue

| Item                                            | Current disposition                                                                                                                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#019` admission/discharge comparison fallback  | Fixed, directly tested, and live-canaried with distinct admission and discharge citations.                                                                                                      |
| `#029` fallback answer quality                  | Fixed. Evaluation separately counts review fallback and denies targeting credit for echoed boilerplate.                                                                                         |
| `#051` scheduled RAG evidence reconciliation    | Completed and compared.                                                                                                                                                                         |
| `#069` table-facts RPC latency                  | Completed. Warm database plans were acceptable and were not the multi-second tail.                                                                                                              |
| `#084` per-result irrelevant-at-10 evidence     | Implemented; human disposition remains under `#023`.                                                                                                                                            |
| `#033` source-governance metadata in the prompt | Implemented in `rag-source-block.ts` with neutral unknown/unrecorded handling and focused tests. The ledger item is stale.                                                                      |
| X6 / `#192` path-specific coverage floors       | Implemented in `vitest.config.mts` for retrieval/ranking, evidence verification, fallback/recovery, and source-governance groups. Remeasure once, then close the stale work order if unchanged. |

### Partially complete work that must not be restarted from zero

| Item            | Completed portion                                                                                      | Residual                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#018`          | Lithium mechanism fixed and live-canaried.                                                             | ADHD corpus/table accessibility and metabolic schedule evidence.                                                                                            |
| `#023`          | 2026-07-26 retrieval and answer artifacts reviewed; per-rank evidence persisted.                       | One green Firefox/WebKit matrix datapoint and qualified human disposition of irrelevant-at-10 labels. Do not buy another RAG run for this.                  |
| `#086` / `#190` | Several cohesive modules extracted from `rag.ts`; current-main `rag.ts` was approximately 4,345 lines. | Continue one-way, behavior-preserving extractions only.                                                                                                     |
| `#098`          | Answer-path and retrieval-core counting proxies exist and are registered in the offline contract.      | Full `/api/search` route-level counting, including route preamble and post-processing.                                                                      |
| `#099`          | Some cache and scope work landed; unsafe admission overlap was reverted and refuted.                   | Individually discharge cache writes, design an atomic anonymous limiter RPC, and remove duplicate identity resolution.                                      |
| `#100`          | Clinical-governance design accepted in `verified-answer-incremental-delivery-design.md`.               | No runtime `verifiedUnit` exists; implement offline contract proof, then governed evidence preview, then separately approved section-generation experiment. |
| `#101`          | Hydration parallelisation shipped.                                                                     | Ledger correction `#186`, then only scope enumeration, typeahead caching, and universal-search coalescing remain candidates.                                |

### New highest-priority RAG correctness issue

`#231` supersedes the old assumption that route/provider timeout is the primary Lithium failure.
Current evidence says generation completed within the candidate budget but failed structured
generation quality. Generation fallbacks are now excluded from the answer cache. The next work is
privacy-safe failure instrumentation, deterministic reproduction, and a bounded output-quality fix.
Do not increase timeouts or cache generation fallbacks without new contrary evidence.

## Codex Cloud context

### Chat-reported environment state — reverify before relying on it

The existing general Cloud environment was `BigSimmo/Database`. During the earlier conversation it
was reported as having:

- Node 24 / npm 11;
- GitHub, OpenAI, and Supabase configuration;
- OCR, Deno, Playwright browser tooling, and container caching;
- Railway CLI aligned to `5.30.1`;
- Codex CLI aligned to `0.146.0`;
- Supabase CLI aligned to `2.108.0`; and
- `CODEX_CLOUD_ACCESS_PROFILE=connected` added.

Those settings were not reverified during this handover task and may have drifted.

### Important unresolved Cloud safety conflict

The inspected environment setup promoted setup-only provider secrets into a persistent shell profile
for the agent phase while agent networking was unrestricted. Current `docs/codex-cloud.md` explicitly
rejects that workaround: Cloud secrets are removed before the agent phase and must not be copied into
profiles, files, caches, logs, or ordinary variables.

Therefore:

1. do not assume the general environment is safe for live provider work;
2. do not reset/rebuild its shared cache until its effective setup is reconciled with current
   `docs/codex-cloud.md` and `scripts/setup-codex-cloud.sh` on current main;
3. run a fresh provider-free Cloud acceptance task first; and
4. use protected/manual provider workflows or another explicitly approved least-privilege mechanism
   for live credentials rather than promoting setup secrets.

The earlier cache-reset confirmation was not completed in the chat. Do not assume a browser tab or
pending confirmation still exists.

### Provider-free Cloud acceptance

In a fresh Cloud task, before RAG work, run only:

```bash
npm run check:codex-cloud
npm run check:runtime
npm run check:installed-lock-parity
npm run check:codex-cloud -- --runtime
```

Report decisive pass/fail lines and tool versions without printing environment values. Do not call a
provider during this acceptance stage.

## Perfected ordered remediation plan

### Phase 0 — Establish a trustworthy execution base

Provider-free.

1. Fetch and verify current `origin/main` without pulling it into a working branch.
2. Inventory open PRs/branches for overlap by affected symbols and routes, not only ledger IDs.
3. Create a clean isolated worktree and task branch.
4. Read `AGENTS.md` and `docs/rag-behaviour/` in the required order.
5. Record current `rag.ts` line count, module ownership, fixtures, manifests, and offline baseline.
6. Run the RAG flightplan for the proposed paths.
7. Reconcile stale tracking:
   - close stale `#033` after current-main confirmation;
   - remeasure and close `#192` if the committed floors remain honest;
   - update `#101` through `#186` to remove shipped hydration work;
   - describe `#098` as partial, not greenfield;
   - keep resolved `#019`, `#029`, `#051`, and `#069` out of the active queue; and
   - update the stale reconciliation header in `rag-hybrid-findings-and-todo.md`.

Stop before writing if the worktree is dirty, protected, stale, or overlaps another active change.

### Phase 1 — Diagnose and fix `#231` structured generation-quality failure

This is the first behavioral priority.

1. Add privacy-safe diagnostic enums and counts for failure stage, schema/parse/quality category,
   section shape, citation membership, numeric support, route/model class, and elapsed time.
2. Record no prompt, answer text, source text, patient data, or secret values.
3. Build a deterministic offline fixture reproducing the structural failure.
4. Separate schema/parse failure, malformed section shape, citation membership, numeric support,
   prompt/contract mismatch, and genuinely over-strict gate behavior.
5. Fix only the reproduced causal cluster.
6. Preserve source-backed fallback, owner scope, governance, citation/numeric gates, current route
   deadline, and the ban on caching every `generation_fallback` spelling.
7. Run focused and offline RAG proof.
8. With separate provider approval, run the exact Lithium probe and standard baseline/post answer
   canary.

Acceptance: substantive verified Lithium output when generation is valid; invalid output fails closed;
no cached fallback; recall remains 1.0; zero citation/numeric regression; no unjustified timeout change.

### Phase 2 — Resolve the two remaining `#018` evidence debts

#### ADHD

1. Confirm whether `CG.MHSP.ADHD.pdf` belongs in the authoritative corpus.
2. Distinguish missing ingestion, failed indexing, absent table extraction, inaccessible chart-only
   content, and owner/visibility problems.
3. Add an offline chart/table fixture before changing ingestion.
4. Repair the smallest evidence or accessibility layer.
5. Do not increase extractive budgets to compensate for missing evidence.

#### Metabolic monitoring

1. Locate an auditable source containing the actual monitoring schedule.
2. Prove the schedule survives parsing, table extraction, and indexing.
3. Add schedule-specific positive and negative fixtures.
4. Adjust structured evidence selection only if the fixture shows it is necessary.
5. Do not revive the reverted plural classifier without materially new evidence.

Hosted corpus reads, ingestion, reindexing, and document mutations require separately approved
provider/operator scope.

### Phase 3 — Complete operator evidence and governance work

#### `#022` BMJ attestation

1. A qualified reviewer examines the top-ten manifest.
2. Reconfirm the prepared migration against current schema.
3. Apply only in an explicitly approved Supabase window targeting the correct project.
4. Attest only records satisfying the encoded evidence policy.
5. Preserve `clinical_validation_status=unverified`.
6. Remeasure warning frequency and append-only history integrity.

#### `#023` browser and label disposition

1. Check whether a newer Firefox/WebKit matrix already completed.
2. If absent, obtain one matrix datapoint after its dependency blocker is green.
3. Do not dispatch another paid RAG run for this item.
4. Have a qualified human disposition the persisted grade-zero rows.
5. Treat label correction and ranking proposals as separate changes.

Native Safari/STP reproduction under `#024` is a separate physical-host acceptance gap.

### Phase 4 — Finish the useful residual of `#098`

Provider-free.

1. Make the search route handler test-injectable without changing production behavior.
2. Drive the real `/api/search` `POST` handler with counted clients.
3. Pin authentication, admission/rate-limit, scope, retrieval, enrichment, telemetry, rejection, and
   abort costs as total plus per-surface breakdown.
4. Preserve admission-before-scope: denied requests issue no scope or retrieval query.
5. Document traffic invisible to the proxy, including another client instance, direct `fetch`, or a
   provider SDK.
6. Register the route-level scenario in the canonical offline RAG contract.
7. Either formally make that runner the single budget home or wire the older offline entrypoints.

Acceptance: an added route-level Supabase trip deterministically fails; retrieval-core cost stays
separately visible; no credentials or live database are required.

### Phase 5 — Reduce `#099` fixed round trips one cluster at a time

Do this only after Phase 4 makes total route cost observable.

#### Cache writes

- Trace each of the eight `setCachedSearch` sites individually.
- Preserve abort checks and move cloning before any deferred boundary when required.
- Prove downstream mutation cannot alter the cached array.
- Defer only individually proven safe sites; do not bulk-replace all awaits.

#### Anonymous rate limiting

- Specify atomic subject-plus-global semantics with denial/concurrency fixtures.
- Author a migration following existing atomic limiter patterns.
- Apply it in an approved database window before switching the application.
- Never use `Promise.all`; it consumes global capacity even after subject denial.

#### Duplicate identity resolution

- Define an unspoofable proxy-to-route verified-claims contract.
- Strip any client-supplied version and bind claims to the request/authentication context.
- Test forged, missing, expired, and mismatched claims.
- Retain current route-side resolution as rollback until the new contract proves safe.

Each cluster is a separate reviewable change.

### Phase 6 — Continue `#190` `rag.ts` decomposition

Provider-free when behavior is byte-identical.

1. Map remaining responsibilities in the approximately 4,345-line orchestrator.
2. Select one cohesive unit with a one-way dependency boundary.
3. Prefer remaining generation orchestration, generation-failure recovery, final response assembly,
   or retrieval coordination clusters.
4. Move implementation byte-for-byte where possible.
5. Preserve public exports, comparator/order semantics, cache keys, abort behavior, telemetry, owner
   scope, fallback behavior, citations, and safety gates.
6. Ratchet the maintainability budget after each extraction.
7. Reject duplicated near-complete orchestrators and import back-edges.

Use `RAG impact: no retrieval behaviour change — byte-identical structural extraction` only when
that statement is true.

### Phase 7 — Implement `#100` in three controlled stages

#### 7A. Offline contract proof

- Add optional `progress.verifiedUnit` schema support.
- Keep only `progress`, `final`, and `error` event names.
- Reject `token`, `revising`, partial JSON, and provisional prose.
- Pin monotonic sequence, bounded payload, exact-subset reconciliation, owner boundaries, and
  danger-level governance refusal.
- Discard previews after error, cancellation, retry, unknown schema, or mismatch.
- Do not render content yet.

#### 7B. Governed evidence preview

- Emit only after ranking, context selection, owner enforcement, canonical governance refusal, and
  client-field trimming.
- Label it `Selected evidence — answer still being verified`.
- Do not present it as answer prose or completion.
- Gate parsing, server emission, and client rendering separately.
- Preserve the canonical final response as authoritative.
- Prove accessible announcements do not repeat prior content or move focus.

#### 7C. Independently verified answer sections

Provider-gated.

- First measure whether complete independently verifiable sections are feasible without cost or
  latency regression.
- Reuse the complete production verification boundary; never implement a weaker stream verifier.
- Never revise displayed prose.
- Fail the stream if final reconciliation would alter an emitted section.
- Roll out internally behind flags before broader exposure.

Naive token streaming remains refuted and out of scope.

### Phase 8 — Reassess remaining performance candidates

Only after `#098`, relevant `#099` work, and `#100` Phase 1 provide measurements.

1. Update `#101` to list only nested scope enumeration, typeahead caching, and universal-search
   coalescing.
2. Evaluate one candidate at a time.
3. Require an offline budget improvement before a live experiment.
4. Require baseline/post retrieval canaries for candidate assembly, truncation, or ordering changes.
5. Keep semantic reranking and broad alias expansion disabled unless an ambiguity-focused canary
   demonstrates material gain without regression.

### Phase 9 — Optional later work

Do not mix these with the core remediation:

- `#102` additive indexes and deterministic title-alias selection;
- `#035` broader conflict detection after a real missed-conflict class is demonstrated;
- `#001` semantic reranking experiment;
- `#100` Phase 2 provider-generation architecture; and
- other ranking or candidate-selection changes without a measured causal case.

## Protected-RAG and clinical invariants

- Flag the user before editing protected RAG surfaces.
- Read `docs/rag-behaviour/` before those edits.
- Never insert a comparator above relevance score.
- Never bulk-merge broad aliases into the strict golden tier.
- Never relax score clamps, grounding, citation, numeric, owner-scope, governance, or fallback gates
  merely to improve headline pass rates.
- Any retrieval/ranking/ordering behavior change needs a live baseline/post canary pair.
- Required canary outcome: document recall 1.0, content recall 1.0, zero per-case reciprocal-rank
  regressions, and no answer-quality/citation/numeric regression.
- Revert immediately if the protected canary regresses.
- PRs touching protected surfaces need the exact `RAG impact:` declaration and the full clinical
  governance preflight where applicable.

## Verification ladder

Select only checks that cover plausible changed failure paths.

Typical provider-free RAG sequence:

```bash
npm run workflow:rag-lab -- --write-evidence
npm run test -- <focused-test-files>
npm run check:rag:fixtures
npm run eval:rag:offline
npm run check:production-readiness
```

Before an authorized push or PR handoff:

```bash
npm run verify:pr-local
npm run format
```

Visible `#100` work also needs focused stream/client tests, `npm run ensure`, and the smallest
appropriate browser gate. Chromium/WebKit emulation does not close physical Safari/PWA acceptance.

Provider-backed commands are separate approval gates, for example:

```bash
npm run eval:rag -- --limit 15
npm run eval:quality -- --rag-only
```

The authorization must name the provider, target, read/write scope, permitted commands, data
exposure, expected cost/cap, stop conditions, and forbidden mutations. A prompt-level dollar limit is
not a hard technical limit unless backed by provider-side budget enforcement.

## Exact recommended next action

Start a fresh task in a clean, current-main worktree and perform Phase 0 only. After the ledger and
baseline are reconciled, implement Phase 1 (`#231`) as the first behavioral change. Do not begin with
ranking, semantic reranking, alias expansion, timeout increases, or streaming.

## Work performed while creating this handover

- Added this documentation file only.
- Ran `npm run workflow:lifecycle -- --phase handoff --write-evidence`.
- Lifecycle evidence was written under `.local/workflow-evidence/` and is expected to remain local.
- No product code, RAG behavior, environment setting, provider service, production data, Git branch,
  commit, push, PR, merge, deployment, migration, or cache was changed by this handover task.

## Verification intentionally not run

No unit, RAG, typecheck, build, browser, provider, or broad PR gate is justified by a documentation-only
handover. Validate this file with focused formatting and link checks only. Implementation verification
belongs to the clean future worktree described above.

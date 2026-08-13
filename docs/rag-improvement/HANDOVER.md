# RAG improvement programme — multi-session handover

**Status:** maintained handover ledger (2026-08-13). This is the context file every cloud
session implementing the programme reads first. The design authority is
[README.md](README.md) in this directory; the protected-surface rules live in
`docs/rag-behaviour/`. This file adds what the guide deliberately does not carry: current
programme state, the per-session work packets, the paste-ready prompts, and the status table
each session must update.

**How to use this file (for the agent reading it at session start):**

1. Read your session's packet below in full, then the matching section of
   [README.md](README.md), then `docs/rag-behaviour/README.md` (and its safeguards page if
   you will touch a protected surface).
2. Run the session-start checklist (§4).
3. Do only your packet. If you finish early, stop — do not start the next packet in the same
   session; context quality drops and the PR-per-session discipline breaks.
4. Before ending: run the session-end checklist (§5) and update the status table (§2) in your
   PR.

---

## 1. Programme state snapshot (as of 2026-08-13)

- **Landed:** the reviewed/updated programme guide (`docs/rag-improvement/README.md`,
  PR #1895, merged 2026-08-13).
- **In flight:** **A1 phase 1 is PR #1899** (`feat(rag): record the structured
generation-quality verdict on fallback`) — structured `GenerationQualityError`
  diagnostics, `generation_quality_gate:*` retry reasons, fallback metadata, and the
  provider-safe `scripts/probe-generation-quality.ts` probe. Sessions S1+ must treat that
  PR's content as existing code once merged. Do not re-implement it.
- **Key issue refs:** `#231` (source-only degradation with healthy retrieval — A1), `#001`
  (semantic rerank stays off — constrains B6), `#100` (perceived latency / no token
  streaming — constrains A1), `#292` (check open PRs before acting on a queued item).
- **Decisive constraint from #231:** the 35–40 s route-budget probes were tested and
  rejected — generation completed inside the deadline and still failed the quality gate.
  Never "fix" A1 by raising `answerRouteBudgetMs` without new evidence that directly rebuts
  that recorded result.

## 2. Status table — update in every programme PR

| Packet | Scope                                          | Branch                                           | PR    | State                   | Canary / evidence refs |
| ------ | ---------------------------------------------- | ------------------------------------------------ | ----- | ----------------------- | ---------------------- |
| Guide  | Programme guide + handover                     | `claude/rag-plan-review-guide-vhrls9`            | #1895 | Merged 2026-08-13       | docs-only              |
| S0     | A1 phase 1: structured fallback diagnostics    | `claude/lithium-generation-quality-debug-ji1vce` | #1899 | Open — driving to merge | offline 93/93 focused  |
| S1     | A1 phase 2: evidence-chosen mitigation         | `claude/rag-a1-mitigation-<suffix>`              | —     | Not started             | —                      |
| S2     | A2+A3: composition menu + length               | `claude/rag-a2-a3-composition-<suffix>`          | —     | Blocked on S1 evidence  | —                      |
| S3     | A4: follow-up suggestion refinement            | `claude/rag-a4-follow-ups-<suffix>`              | —     | Blocked on S2           | —                      |
| S4     | B0: adversarial fixtures + baseline + register | `claude/rag-b0-adversarial-fixtures-<suffix>`    | —     | Ready (parallel-safe)   | —                      |
| S5     | B1+B2: telemetry assessment + offline harness  | `claude/rag-b1-b2-harness-<suffix>`              | —     | Blocked on S4           | —                      |
| S6     | B3: Docling lab benchmark                      | `claude/rag-b3-docling-lab-<suffix>`             | —     | Blocked on S4           | —                      |
| S7+    | B4 shadow / B5 Ragas / B6 reranker / B7 DSPy   | —                                                | —     | Gated — owner decision  | —                      |

Update rule: the session that opens a packet's PR edits its row (branch, PR number,
state) in the same PR. A later session updating another packet may also correct stale rows
it can verify from GitHub/git state. Keep rows one line.

## 3. Session packets

Every packet inherits the standing rules in §6. "Done" for a packet always ends at an open
PR with the correct body, a ledger append, and an updated status row — never at a merge (the
owner merges) and never at watching CI.

### S1 — A1 phase 2: choose and implement the mitigation from evidence (`#231`)

- **Precondition:** PR #1899 merged; its diagnostics available. If live
  `generation_quality_gate:*` distributions exist in `rag_queries.metadata`, ask the owner
  for the aggregate counts (reading live Supabase is provider-gated — do not query it
  yourself without explicit approval). Otherwise reproduce offline with
  `scripts/probe-generation-quality.ts` and the offline fixtures.
- **Work:** follow README §A1's mitigation ladder in order: (1) fix the dominant specific
  generation-quality/verification/composition failure; (2) reduce pre-generation latency if
  measurements show it starves generation; (3) route length-heavy classes
  (`broad_summary`, `comparison`) to strong in `chooseAnswerRoute` **before** the deadline
  is created — not in `shouldRetryWithStrongAfterFast`; (4) budget changes only with
  evidence rebutting #231's stop condition.
- **Files:** `src/lib/rag/rag.ts`, `src/lib/rag/rag-routing.ts` (only for option 3),
  targeted tests. `src/lib/rag/rag-route-budget.ts` out of scope unless option 4's evidence
  bar is met.
- **Gates:** offline `eval:rag:offline` + 44-case + 30-case suites; any behaviour change →
  `RAG impact: behaviour change — canary pair <baseline> -> <post>` (owner approves each
  dispatch); Clinical Governance Preflight; `verify:pr-local`.
- **Done:** PR open with the mitigation, its evidence trail (which gate reasons dominated,
  why this rung of the ladder), and a fallback-rate non-inferiority argument.

### S2 — A2 + A3: intent-conditioned related information + moderate length

- **Precondition:** S1 merged (its evidence determines how much length headroom exists).
- **Work:** exactly README §A2 + §A3. New pure module `src/lib/rag/answer-composition.ts`
  mapping (`RagQueryClass`, `ClinicalQueryIntent`) → composition menu; one
  `related_information_menu:` line in `buildAnswerInput`'s "Interpreted clinical task"
  block; one paragraph in `answerInstructions` §"Answer sections"; prompt length targets
  35–75 → ~60–110 words, sections 2–5 → 3–6; keep "narrow question → narrow answer"
  verbatim. Bump `ragAnswerPromptVersion` (`src/lib/rag/rag-versioning.ts`). Check
  `trustCaps` in `src/lib/answer-render-policy.ts` accommodates larger menus.
- **Hard boundaries:** grounding contract untouched (every section cites or is omitted); no
  retrieval/ranking/selection edit of any kind; no new pipeline stage, `RagAnswer` field, or
  render block.
- **Gates:** offline 30/30 + 44-case re-baseline; 36/36 stays trivially green (retrieval
  untouched); live canary pair (prompt change = behaviour change); Gate E before/after
  answer comparison on the 30 `answerQualityEvalCases` + ~10 owner-chosen live questions;
  Clinical Governance Preflight.
- **Done:** PR open with menu table, prompt diff, offline baselines, and the canary-pair
  request spelled out for the owner (not executed without approval).

### S3 — A4: refine the existing follow-up suggestions

- **Precondition:** S2 merged (uses its composition menu).
- **Work:** README §A4. Improve `buildAnswerFollowUpSuggestions` in
  `src/lib/answer-follow-up.ts` **in place**: consume the A2 composition menu, require the
  suggested subject to appear in retrieved evidence, suppress redundant/already-answered
  suggestions, keep deterministic phrasing, zero extra provider calls. Touch
  `ClinicalDashboard.tsx` only if the function's input contract must expand.
- **Hard boundaries:** no second follow-up module, no new `RagAnswer` field, no new render
  block, generation prompt untouched.
- **Gates:** focused unit + DOM tests for both existing chip surfaces (phone + desktop);
  `RAG impact: no retrieval behaviour change — deterministic follow-up composition only`;
  `verify:phone-chrome` only if shared composer chrome changes.

### S4 — B0: adversarial fixture contract, baseline, data-flow register

- **Precondition:** none — parallel-safe with S1–S3 (disjoint files).
- **Work:** README §B0. New `scripts/check-rag-adversarial-fixtures.mjs` +
  `npm run check:rag:adversarial-fixtures` (the existing `check:rag:fixtures` is untouched);
  `scripts/fixtures/rag-adversarial-cases.v1.json` + schema, 20–30 synthetic cases across
  the 8 categories, PHI-like canary strings, validator rejects canaries in reportable
  output; baseline record + report key; `docs/rag-improvement/data-flow-register.md`.
  Remove the now-built paths from the `ALLOWLIST` in `scripts/check-docs-links.mjs` and the
  planned command from `scripts/check-docs-script-refs.mjs` in the same PR.
- **Hard boundaries:** fixtures are synthetic only — never real clinical text, filenames, or
  identifiers; the validator is deterministic and network-free.
- **Gates:** `verify:pr-local` (script changes fail closed to the heavy offline scope —
  expect lint/typecheck/full unit suite); `RAG impact: no retrieval behaviour change —
offline fixtures and validation only`.

### S5 — B1 + B2: telemetry gap assessment + offline adversarial harness

- **Precondition:** S4 merged (fixtures exist). Reuses A1 phase 1's instrumentation — read
  what #1899 landed before proposing new fields.
- **Work:** README §B1 + §B2. Dashboard questions first; add `RAG_TELEMETRY_EXTENDED`
  (typed, default `false`) only for proven gaps, with unit tests proving canaries never
  appear in emitted objects. Then the offline adversarial runner
  (`eval:rag:adversarial:offline`) over S4's fixtures — Promptfoo pinned as a dev
  dependency, or a plain Vitest harness if the dependency footprint is heavy (the fixtures
  and assertions are the asset, not the runner). Route it via `scripts/ci-change-scope.mjs`
  to RAG-surface PRs only; fail closed on missing fixture, network attempt, budget breach.
  Close the Phoenix decision record as deferred.
- **Gates:** `verify:pr-local`; dependency change (if Promptfoo) makes the PR
  operational-risk — do not bundle anything else with it.

### S6 — B3: Docling lab benchmark (isolated)

- **Precondition:** S4 merged (shared report-key convention). Independent of S1–S3.
- **Work:** README §B3. Everything under `eval/docling/` with a fully hashed lockfile and
  its own venv; sandboxed (non-root, no egress, CPU/memory/wall-clock/output limits);
  30–50 public/synthetic fixtures + hostile corpus; compare against the legacy extractor on
  parse success, resource bounds, table precision/recall, exact number/unit/comparator
  checks; aggregate-only reports.
- **Hard boundaries:** do NOT touch `worker/python/requirements*`, `Dockerfile.worker`,
  `worker/main.ts`, `src/lib/extractors/document.ts`, or the database. Benchmark runs are
  manual/dispatch-only.
- **Done:** PR open with the harness plus a Gate B decision record template; the benchmark
  verdict itself is a separate owner-reviewed run.

### S7+ — gated packets (do not start without an explicit owner decision)

- **B4 Docling shadow** — only after Gate B passes; worker-only,
  `WORKER_DOCUMENT_EXTRACTOR_MODE` default `legacy`; `ingestion-worker-reviewer` subagent
  reviews the PR.
- **B5 Ragas pilot** — offline, judge-model use needs Gate A approval first.
- **B6 reranker benchmark** — offline; refutation constraints from README §B6 are binding
  (differently-relevant candidates; any serving score strictly below `relevance.score`;
  coordinate with `#001`).
- **B7 DSPy lab** — blocked on a ≥100-case clinician-reviewed dataset that does not exist.

## 4. Session-start checklist

1. `git fetch origin main` and branch fresh: `git checkout -B <packet branch> origin/main`
   (or use the `newtask` skill for a full worktree bootstrap). Never build on a stale head.
2. Read: your packet here → the matching README section → `docs/rag-behaviour/README.md`
   (+ `safeguards.md` before touching any protected surface).
3. Check the packet's status row AND the open PR list for a duplicate implementation
   (`#292`: an open ledger row is not proof nobody is building it — PR #1899 already covers
   A1 phase 1).
4. State the RAG-impact flag to the owner in your first message if your packet touches a
   protected surface (all of Track A does).
5. Confirm what is NOT authorised: live canary dispatches, provider-backed evals
   (`eval:rag`, `eval:quality`, `check:supabase-project`, `verify:release`), Supabase reads,
   reindexing, and merging — each needs the owner's explicit per-action approval.

## 5. Session-end checklist

1. Smallest correct gate run with the decisive output line pasted (exit 0 alone is not
   proof). `npm run format` and **commit the formatted result** before push.
2. PR body from `.github/pull_request_template.md` in full prose: correct `RAG impact:`
   line, Clinical Governance Preflight when the packet touches clinical/RAG surfaces,
   verification evidence, risk/rollback.
3. `npm run ledger:append -- --ref <branch> --head <full-sha> --scope "<scope>" --outcome
<o> --checks "<checks>"`, commit the record file, push.
4. Update this file's status table row in the same PR.
5. Offer `/issues capture` for anything unresolved, then **stop at the open PR** — the owner
   merges; do not watch CI unless explicitly asked.

## 6. Standing rules (summary — AGENTS.md and the guide are authoritative)

- **Protected surfaces:** everything under `src/lib/rag/**`, `clinical-search.ts`,
  `retrieval-selection.ts`, `released-search-order.ts`, `ranking-config.ts`,
  `answer-ranking.ts`, `semantic-rerank.ts`, eval scripts/fixtures, retrieval RPCs. Flag
  before editing; `RAG impact:` line in the PR; behaviour change → live canary pair.
- **Refuted shapes (never re-walk):** feature-weight tuning; any comparator key above
  `relevance.score`; governance currentness penalties/boosts; token streaming; route-budget
  increases as the #231 fix.
- **Provider boundary:** OpenAI/Supabase/hosted-CI/live evals need explicit owner
  confirmation per action. Offline/mocked first, always.
- **One packet, one PR, one session.** No bundling across RAG-impact boundaries.
- **Evidence is never compressed:** paste the decisive gate line; state verified vs assumed.

## 7. Paste-ready session prompts

Copy one prompt per new cloud session, verbatim. Each deliberately grants nothing beyond its
packet — canary runs, provider calls, and merges still require separate owner approval
inside the session.

**S1 (A1 phase 2):**

> Implement packet S1 from `docs/rag-improvement/HANDOVER.md` in BigSimmo/Database: choose
> and implement the evidence-based mitigation for issue #231 using the structured
> generation-quality diagnostics landed by PR #1899. Read the S1 packet, then
> `docs/rag-improvement/README.md` §A1, then `docs/rag-behaviour/` before editing anything.
> This touches protected RAG surfaces — flag RAG impact first. Follow the mitigation ladder
> in order; do not change route budgets without evidence rebutting #231's recorded stop
> condition. No provider-backed commands or live canary dispatches without asking me first.
> Finish at an open PR with ledger append and an updated HANDOVER status row, then stop.

**S2 (A2 + A3):**

> Implement packet S2 from `docs/rag-improvement/HANDOVER.md` in BigSimmo/Database:
> intent-conditioned related-information composition plus the moderate answer-length
> increase, per `docs/rag-improvement/README.md` §A2 and §A3. Read the S2 packet, both
> README sections, and `docs/rag-behaviour/` first — this changes the generation prompt, a
> protected surface; flag RAG impact before editing. Grounding contract and retrieval are
> untouched. Re-baseline the offline answer-quality suites, bump `ragAnswerPromptVersion`,
> and prepare (but do not dispatch) the live canary-pair request for my approval. Finish at
> an open PR with ledger append and an updated HANDOVER status row, then stop.

**S3 (A4):**

> Implement packet S3 from `docs/rag-improvement/HANDOVER.md` in BigSimmo/Database: refine
> the existing follow-up suggestions in `src/lib/answer-follow-up.ts` per
> `docs/rag-improvement/README.md` §A4 — composition-menu aware, evidence-gated,
> deterministic, no new module/field/render block, generation prompt untouched. Read the S3
> packet and README §A4 first. Finish at an open PR with focused unit/DOM proof for both
> chip surfaces, ledger append, and an updated HANDOVER status row, then stop.

**S4 (B0):**

> Implement packet S4 from `docs/rag-improvement/HANDOVER.md` in BigSimmo/Database: the
> adversarial fixture contract, validator command `check:rag:adversarial-fixtures`, baseline
> record, and data-flow register per `docs/rag-improvement/README.md` §B0. Fixtures are
> synthetic only with PHI-like canary strings; the validator is deterministic and
> network-free. Remove the corresponding planned-path allowlist entries from
> `scripts/check-docs-links.mjs` and `scripts/check-docs-script-refs.mjs` in the same PR.
> Finish at an open PR with ledger append and an updated HANDOVER status row, then stop.

**S5 (B1 + B2):**

> Implement packet S5 from `docs/rag-improvement/HANDOVER.md` in BigSimmo/Database: the
> telemetry gap assessment and the offline adversarial regression harness per
> `docs/rag-improvement/README.md` §B1 and §B2, over the fixtures landed by packet S4. Read
> what PR #1899 already instruments before proposing new telemetry fields; any new fields
> are allow-listed metadata with canary-absence unit tests, behind `RAG_TELEMETRY_EXTENDED`
> defaulting false. The harness is network-free and routed to RAG-surface PRs only. Finish
> at an open PR with ledger append and an updated HANDOVER status row, then stop.

**S6 (B3):**

> Implement packet S6 from `docs/rag-improvement/HANDOVER.md` in BigSimmo/Database: the
> isolated Docling lab benchmark under `eval/docling/` per
> `docs/rag-improvement/README.md` §B3. Hard boundary: do not touch the worker, its
> requirements, Dockerfile.worker, the extractors, or the database — this is a sandboxed,
> egress-blocked, dispatch-only lab with public/synthetic fixtures and a hostile corpus,
> reporting aggregates only. Finish at an open PR containing the harness and a Gate B
> decision-record template, with ledger append and an updated HANDOVER status row, then
> stop.

---

_When all Track A packets and B0–B3 are merged, revisit §S7+ with the owner: Gate B verdict
for Docling shadow, whether Ragas/reranker experiments are still wanted, and whether the
DSPy dataset effort should start._

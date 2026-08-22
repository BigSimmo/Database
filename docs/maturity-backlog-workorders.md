# Maturity backlog — work orders

Living tracker that turns the deferred backlog from
[`docs/audit/2026-07-20-repository-maturity.md`](audit/2026-07-20-repository-maturity.md) §10
(plus the §8 repository-host checklist, mirrored under "Maintainer host actions" below)
into actionable, sequenced work orders. Each item states its **outcome**, **approach**, **key
files**, **risk**, **verification**, and **status**. High-risk items are deliberately kept as
their own work order — the audit's rule is one dedicated PR + full-suite verification per
structural change, not a single mixed PR.

**Status legend:** `DONE` (landed) · `IN PROGRESS` (partially landed; more PRs remain) ·
`READY` (scoped, safe to start) · `OPEN` (needs a decision or a dedicated PR) ·
`PROVIDER-GATED` (touches live DB/CI/provider — needs explicit confirmation) · `SATISFIED`
(already true in the repo; no work needed).

---

## Now — foundational, low-risk

### N1 · Dependabot grouping — `DONE`

- **Outcome:** fewer, batched dependency PRs instead of up to ~10/week for a solo maintainer.
- **Approach:** group npm minor/patch by dependency-type (production/development) and group all
  github-actions bumps; majors stay individual.
- **Files:** `.github/dependabot.yml`.
- **Risk:** none (config only).
- **Verification:** valid YAML; takes effect on the next Monday cadence.
- **Landed in:** #985.

### N2 · Dependency-report workflow decision — `DONE`

- **Outcome:** an active fortnightly dependency report (option a), not one less workflow.
- **Landed (#986):** uncommented the `schedule:` cron in `.github/workflows/dependency-report.yml`
  (07:00 UTC on the 1st and 15th) so the report-only workflow (`npm audit` + a rolling GitHub
  issue) runs on cadence, complementing Dependabot with an outdated-direct-deps view.
- **Files:** `.github/workflows/dependency-report.yml`.
- **Risk:** low — report-only; it writes a rolling issue, with no code or deploy change.

---

## Next — high-value maturity (each its own PR)

### X1 · Import-boundary ESLint rule — `DONE`

- **Outcome:** two prose invariants become CI-enforced instead of review-enforced.
- **Findings from verification (2026-07-20):**
  - _Mockup invariant — viable._ All 36 `*mockup*` imports under `src/app/**` are confined to
    `src/app/mockups/**` (which is 404 in production). A rule forbidding mockup imports
    **outside** `src/app/mockups/**` has **zero current violations**.
  - _Service-role invariant — invalid as originally stated._ 30+ server API routes legitimately
    import the service-role admin client (`@/lib/supabase/admin`). The real invariant — "no
    service-role client in the **client bundle**" — is already enforced by
    `npm run check:client-bundle-secrets` + the `server-only` marker. Do **not** add a
    "only `admin.ts` may import the service-role client" rule; it would wrongly break lint.
- **Landed (#986):** added the `no-restricted-imports` mockup-pattern block in `eslint.config.mjs`
  with an override that ignores `src/app/mockups/**` and the `**/*mockup*` sources, so a mockup
  import into a shipped route now fails lint. The service-role rule was intentionally **not**
  added — it is already covered by `check:client-bundle-secrets` + the `server-only` marker.
- **Files:** `eslint.config.mjs`.
- **Risk:** low-medium — verified it does not flag the legitimate `src/app/mockups/**` routes.
- **Verification:** `npm run lint` passes with **0** new errors; a deliberately-wrong mockup
  import is correctly rejected.

### X2 · `src/lib` domain-directory extraction — rag pilot — `DONE`

- **Outcome:** the first real domain directory; unblocks directory-scoped boundary rules for the
  rest of `src/lib` (176 top-level `.ts` files remain after the move).
- **Landed (#994):** `git mv` the 22-file `rag` cluster (`rag.ts` + 21 `rag-*.ts`) into `src/lib/rag/`;
  codemod every `@/lib/rag*` and `../src/lib/rag*` importer to `.../rag/rag*`; updated the budgets
  key, the client-bundle boundary + worker-deploy test fixtures, `docs/codebase-index.md`, and
  the rag path references across 13 maintained docs. **Pure moves + path rewrites, no logic
  change.**
- **Verification:** `typecheck`, full `test` suite (only the pre-existing container-only
  `pdf-extraction-budget` flake fails — confirmed identical on `origin/main`), `lint`,
  `docs:check-index`, `docs:check-links`, and maintainability budgets all pass.

### X3 · Decompose the monoliths — `IN PROGRESS`

- **Outcome:** shrink the three files the maintainability ratchet caps but never reduces:
  `src/lib/rag/rag.ts` (5,018), `src/components/ClinicalDashboard.tsx` (was 4,271, now 4,140),
  `src/components/DocumentViewer.tsx` (was 3,164, now 1,733).
- **Progress (#997):** extracted the evidence-gate predicates from `rag.ts` into
  `src/lib/rag/rag-evidence-gates.ts` (rag.ts 5,147 → 5,018), pure moves behind the existing
  budgets.
- **Progress (#086):** extracted the evidence coverage gate from `rag.ts` into
  `src/lib/rag/rag-coverage-gate.ts` — `evaluateEvidenceCoverageGate` plus the
  `applyCoverageGateTelemetry` helper it owns, moved byte-for-byte (rag.ts 5,030 → 4,780,
  budget ratcheted to 4,780). The shared `visualEvidenceUnitTypes` taxonomy moved to
  `rag-evidence-gates.ts` because rag.ts's second-stage rerank still reads it; that keeps the
  new module cycle-free, and `rag.ts` re-exports `evaluateEvidenceCoverageGate` so the public
  `@/lib/rag/rag` API is unchanged. `prepareCoverageGateResults` deliberately stayed in
  `rag.ts`: it is pipeline orchestration that calls the metadata/visual hydration and
  second-stage rerank helpers, so moving it would need a runtime back-edge to `rag.ts`. The
  hydration cluster is the separate later extraction (`rag-hydration.ts`).
- **Progress (#086, X3 second-stage extraction, PR #1472):** extracted the cohesive
  second-stage reranking unit into `src/lib/rag/rag-second-stage.ts`: engagement policy,
  score adjustment, document diversity, subject-match protection, and its retrieval-layer
  telemetry moved together without changing the public `@/lib/rag/rag` export. `rag.ts`
  remains the retrieval orchestrator and calls the extracted unit at the same pipeline
  points (4,543 → 4,351; budget ratcheted to 4,351).
- **Progress (`DocumentViewer.tsx`):** extracted the cohesive leaf modules into
  `src/components/document-viewer/` — shared row `types.ts`, `source-panels.tsx` (summary
  profile, high-yield summary, source images/tables, pinned evidence, indexed-text panel), the
  behaviour-bearing `manual-tag-editor.tsx` (add/rename/delete manual labels), and
  `document-overview-landing.tsx`. The moves are verbatim (no logic changed); the container is
  now composition-focused — it retains the detail fetch, dynamic PDF loading, and state
  orchestration (3,164 → 1,733, budget ratcheted to 1,733).
- **Progress (`ClinicalDashboard.tsx`):** the dashboard was already heavily decomposed (72
  `clinical-dashboard/*` modules), so this is an incremental ratchet across several small PRs —
  extracted the self-contained answer-thread turn leaf (`AnswerTurn` type, `maxVisiblePriorTurns`,
  `PriorAnswerTurnSurface`) into `clinical-dashboard/answer-thread-turn.tsx` (#1034), then the
  upload-view desktop-layout media-query store into the `useUploadDesktopLayout()` hook
  (`clinical-dashboard/use-upload-desktop-layout.ts`, #1042). All verbatim moves (4,271 → 4,140,
  budget ratcheted to 4,140); #1047 additionally hardened the regression guard that pins the
  extracted hook's `useSyncExternalStore` wiring. The residual is a tightly-coupled orchestrator
  core; further safe extractions are smaller, incremental units. `rag.ts` remains the largest open
  target.
- **Progress (X3 hydration unit, PR #1463):** extracted per-request hydration from `rag.ts` into
  `src/lib/rag/rag-hydration.ts` — `DocumentRankingMetadataCache`,
  `createDocumentRankingMetadataCache`, `attachDocumentRankingMetadata`, `withCachedIndexQuality`,
  `attachIndexQualityMetadata`, `attachPageVisualEvidence`, moved byte-for-byte (rag.ts 4,780 →
  4,543, budget ratcheted to 4,543). Cycle-free: the cluster referenced no `rag.ts`-local symbol,
  so the module imports only stable siblings and `rag.ts` re-exports the two names
  `tests/rag-query-concurrency.test.ts` imports. `prepareCoverageGateResults` still cannot move —
  hydration covered only two of its five `rag.ts`-only dependencies; the rest
  (`selectRankedRetrievalResults`, `applySecondStageRerankIfNeeded`, `measureSearchPhase`) are a
  separate ranking/timing seam.
- **Approach:** extract cohesive units behind the existing budgets; the components decompose
  into their `*/` sibling directories, and `rag.ts` is the natural seam now that X2 has landed.
- **Risk:** HIGH (behavioural surface). One file per PR.
- **Verification:** `npm run typecheck` + `npm run test` (+ `npm run verify:ui` for the components).

### X4 · SAST-blocking on the parser/ingestion path — `DONE`

- **Outcome:** Semgrep ERROR findings block on the untrusted-PDF surface, not just advise.
- **Approach:** add a path-scoped Semgrep job (targets `worker/**`, `src/lib/ingestion*`,
  `src/lib/extractors/**`, ingestion API routes) **without** `continue-on-error`. Triage the
  current advisory findings on those paths first so the gate starts green.
- **Files:** `.github/workflows/sast.yml`.
- **Risk:** MEDIUM — could block on pre-existing findings if not triaged first.
- **Verification:** a Semgrep run over the scoped paths reports zero ERROR before flipping the gate.
- **Shipped 2026-07-21 (this PR):** `semgrep-ingestion-gate` job in `sast.yml` (no `continue-on-error`,
  container digest-pinned to the triage-verified `semgrep/semgrep:1.168.0` image),
  scoped to `worker`, `src/lib/ingestion*.ts`, `src/lib/extractors`, `src/app/api/ingestion`,
  `src/app/api/upload`, with `p/python` added for the OCR stack. Triage ran the CI-pinned
  `semgrep/semgrep:1.168.0` image over the scoped paths: 0 ERROR findings (24 TS rules,
  17 files; 55 Python rules, 3 files) — the gate starts green. Both policy halves
  (advisory repo-wide, blocking ingestion gate) are enforced by `check-github-action-pins.mjs`.

### X5 · ACL-migration consolidation review — `PROVIDER-GATED (DB owner)`

- **Outcome:** a settled grant model instead of repeated `repair/reassert/enforce` migrations
  (the 2026-07-19 cluster).
- **Approach:** DB-owner review of the repeated privilege-repair migrations; replace with a single
  canonical grant migration if the churn reflects an unsettled policy rather than genuine drift.
- **Files:** `supabase/migrations/*` (privilege-repair set), `supabase/schema.sql`, `docs/database-drift-detection.md`.
- **Risk:** HIGH (schema/live-DB semantics).
- **Verification:** `npm run check:drift` + the CI `db-reset-verify` replay; **live-DB work is
  confirmation-required** per the AGENTS.md provider boundary.

### X6 · Raise coverage floors for clinical domains — `DONE`

- **Outcome:** higher targeted thresholds where correctness matters most (clinical-safety,
  retrieval, answer) than the current global 38–50%.
- **Landed (ledger #192, 2026-08-14):** `vitest.config.mts` already carried four per-domain
  coverage-threshold groups — retrieval (`clinical-search`, `retrieval-selection`,
  `answer-ranking`, `clinical-value-binding`, `medication-entities`,
  `rag-candidate-sources`, `rag-context-selection`, `rag-retrieval-variants`,
  `rag-routing`), evidence/verification (`answer-verification`, `evidence`,
  `evidence-relevance`, `rag-claim-support`, `rag-evidence-gates`,
  `rag-quote-verification`, `rag-source-segmentation`), core RAG/answer (`rag`,
  `rag-extractive-answer`, `rag-comparison`, `rag-answer-support`), and
  clinical-safety/governance (`clinical-safety`, `source-governance`, `source-review`,
  `clinical-review-queue`, `answer-response`) — plus a whole-repository floor, all
  CI-enforced by the required `coverage` job (`npm run test:coverage`) on every PR that
  touches executable scope. This closed out most of X6 before this ledger item was
  worked; re-measuring on 2026-08-14 confirmed the floors were honest (no false
  failure) and found two branch thresholds that had drifted past this file's own
  documented 5pp re-ratchet trigger, so those two were raised (never lowered) to
  restore headroom: evidence/verification branches 81 → 84 (measured 86.04%, gap was
  5.04pp) and core RAG/answer branches 72 → 76 (measured 78.22%, gap was 6.22pp). No
  other value in this file needed a change — every other floor already sat within the
  5pp band. No file in the four domain groups showed a genuine untested critical path:
  the per-file low points were 76.4% statements (`rag-quote-verification.ts`) and 57.7%
  branches (`rag-answer-support.ts`), well clear of the "under 30%" bar this ledger item
  treats as scary, so no padding tests were added, per the ledger's own stop condition.
- **Files:** `vitest.config.mts`, `docs/maturity-backlog-workorders.md`.
- **Risk:** MEDIUM — needs real tests, not just a threshold bump. (No new tests were
  needed this pass; the floors were already backed by real, passing coverage.)
- **Verification:** `npm run test:coverage` — 606 files / 6549 tests passed, all
  thresholds green, both before and after the two branch-floor raises.

### X7 · Complete the `src/lib` domain-directory reorg — `OPEN`

- **Outcome:** finish what the X2 rag pilot started — give the remaining ~176 flat `src/lib/*.ts`
  files real domain directories (answer, ingestion, document, source-governance clusters), which
  unblocks directory-scoped import-boundary rules for the whole library layer.
- **Approach:** one cohesive cluster per PR, following the X2 pattern (#994): `git mv` the cluster
  into `src/lib/<domain>/`, codemod every importer, update the budgets keys + client-bundle/worker
  fixtures + `docs/codebase-index.md`. Pure moves + path rewrites, no logic change.
- **Files:** `src/lib/**` and importers across `src/`, `scripts/`, `tests/`, `worker/`.
- **Risk:** MEDIUM-HIGH — high import-churn; the answer/retrieval clusters touch RAG-ranking
  protected surfaces, so **flag before editing** and add the `RAG impact:` line where applicable.
- **Verification:** `npm run typecheck` + `npm run test` + `npm run docs:check-index` +
  `npm run docs:check-links` + maintainability budgets, per cluster.

---

## Later — useful, non-essential

### L1 · Archive one-shot scripts — `IN PROGRESS`

- **Outcome:** `scripts/` shows live tooling, not historical residue.
- **Approach:** once their migrations have shipped, move one-shots (`check:m13-migration`,
  `check:july8-live-batch`, completed dated `backfill:*`) to `scripts/archive/`. Verify each
  migration is live before archiving its checker.
- **Progress (#1033, incidental):** `check-m13-migration.ts`, `check-july8-live-batch.ts`, and the
  latter's `.test.ts` were moved into `scripts/archive/` (collateral of a knip fix — an orphaned
  test referenced a deleted script). That PR also dropped the two `package.json` entries but left
  five maintained operator docs (`launch-operator-runbook`, `operator-apply-july8-batch`,
  `operator-backlog`, `process-hardening`, `tenancy-defense-in-depth-review`) still calling
  `npm run check:july8-live-batch` / `check:m13-migration`, so the advisory `docs:check-scripts`
  gate went red (6 stale references).
- **Progress (this PR):** reconciled that aftermath. Both scripts are live-DB re-verification probes
  (import-clean from `archive/`, no relative imports), so the two `package.json` entries were
  restored pointing at `scripts/archive/` — the documented operator commands work again and
  `docs:check-scripts` is green, with **no** operator-doc rewrites. `docs/scripts-index.md` now
  records them as archived-but-runnable.
- **Residual (OPEN):** (a) the completed `backfill:*` / `derive-unknown-status` /
  `reindex-image-generation-metadata` / `measure-wrapped-dose-prevalence` one-shots still await a
  per-script retirement confirmation before archiving; (b) `scripts/ci-change-scope.mjs` still lists
  `check-m13-migration` in its DB-scope regex — now a dead alternation (the file moved to
  `archive/`); harmless, deferred to avoid touching the CI classifier in a docs-scoped PR.
- **Risk:** low (confirm each is truly retired before archiving). **Companion (done):** the
  discoverability half — a curated script map — ships as
  [`docs/scripts-index.md`](scripts-index.md).

### L2 · Single-SHA-per-action uniformity — `DONE`

- **Outcome:** every third-party action pinned to one SHA across all workflow + composite files.
- **Landed:** aligned the laggards (`actions/checkout` v6.0.3 → v7.0.0 in 5 workflows,
  `actions/setup-node` v5.0.0 → v7.0.0 in the `setup-node-cached` composite) and extended
  `scripts/check-github-action-pins.mjs` to assert one SHA per action across **workflows and
  composites** — the checker previously scanned only workflows, so the composite skew was invisible.
- **Files:** `scripts/check-github-action-pins.mjs`, `.github/actions/setup-node-cached/action.yml`,
  5 workflow files.
- **Verification:** `npm run check:github-actions` passes; a reintroduced skew is correctly rejected.

### L3 · Single gate manifest — `DONE`

- **Outcome:** `verify:cheap:internal` and CI's `static-pr` step list are cross-checked so a
  gate can't be added to one and missed in the other.
- **Landed (#1002):** `scripts/check-gate-manifest.mjs` parses the `verify:cheap:internal` chain
  from `package.json` and the `npm run` steps from `ci.yml`'s `static-pr` job (with an anchored
  regex that ignores YAML comments) and fails if any local gate is missing in CI; wired in as
  `check:gate-manifest` inside the gate chain and as a CI step, and `ci.yml` grew the four
  previously-local-only gates so the two lists match.
- **Files:** `scripts/check-gate-manifest.mjs`, `package.json`, `.github/workflows/ci.yml`.
- **Verification:** the self-test passes (20 gates) and fails if the two lists diverge.

### L4 · Rotate the branch-review ledger — `DONE`

- **Outcome:** `docs/branch-review-ledger.md` stays navigable; historical rows live under
  `docs/archive/branch-review-ledger-<yyyy-qN>.md`.
- **Approach:** `npm run ledger:rotate` moves rows older than a cutoff (default: current
  calendar-quarter start); `ledger:lookup` / `sweep:branch-ledger` read live + archives;
  `check:branch-review-ledger` validates archive structure. Bootstrap on 2026-07-30 used
  `--before 2026-07-29` because the whole history was one month old.
- **Risk:** low.

### L5 · Documentation quick-wins — `DONE` / `SATISFIED`

- **AI tooling map** — `DONE` (#985): which of the five agent systems owns which job, in
  `docs/agents-guide.md`.
- **WCAG target** — `DONE` (#985): WCAG 2.2 AA named as the target in `docs/design-system.md` §7.
- **RPO/RTO** — `SATISFIED`: already documented in
  [`docs/disaster-recovery-runbook.md`](disaster-recovery-runbook.md) (the recovery-layers table),
  so the audit's "record RPO/RTO" item needs no new work.

---

## Maintainer host actions (GitHub UI — not repo files)

These are repository-host settings only the maintainer can apply in the GitHub UI; they are not
code and cannot be delivered by a PR. Full checklist in
[`docs/audit/2026-07-20-repository-maturity.md`](audit/2026-07-20-repository-maturity.md) §8.

- **M1 · Repo-host hardening — `OPEN` (maintainer):** branch-protection rulesets + required-check
  selection (the `pr-required` aggregate + Gitleaks); private vulnerability reporting; secret
  scanning + push protection; Dependabot alerts; auto-delete merged branches; environment
  protections; merge method; tag protection. (The `sharp <0.35.0` advisory item from §8 is now
  resolved on `main`.)

---

## Not recommended (disproportionate for this repo)

A formal architecture-docs folder + numbered-ADR process · `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` /
`CHANGELOG.md` · microservice split · a second dependency bot · a new observability vendor · a
published OpenAPI/GraphQL contract (single internal client). Revisit the governance files only if
collaborators join — `AGENTS.md` + the PR template already carry that load.

---

## Progress summary

| Item                             | Priority   | Status                                                                             |
| -------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| N1 Dependabot grouping           | Now        | **DONE** (#985)                                                                    |
| N2 Dependency-report decision    | Now        | **DONE** (#986, enabled)                                                           |
| X1 Import-boundary linter        | Next       | **DONE** (#986; service-role rule dropped)                                         |
| X2 `src/lib` rag extraction      | Next       | **DONE** (#994)                                                                    |
| X3 Monolith decomposition        | Next       | IN PROGRESS (DocumentViewer #1025 + Dashboard #1034/#1042/#1047 done; rag.ts open) |
| X4 SAST-blocking on parser       | Next       | **DONE** (gate + policy check)                                                     |
| X5 ACL-migration consolidation   | Next       | PROVIDER-GATED (DB owner)                                                          |
| X6 Coverage floors               | Next       | **DONE** (ledger #192)                                                             |
| X7 `src/lib` domain reorg (rest) | Next       | OPEN (follow-on to X2; needs RAG flag on answer/retrieval clusters)                |
| L1 Archive one-shot scripts      | Later      | IN PROGRESS (#1033 archived m13/july8; refs reconciled; backfills open)            |
| L2 Action-SHA uniformity         | Later      | **DONE** (#992)                                                                    |
| L3 Single gate manifest          | Later      | **DONE** (#1002)                                                                   |
| L4 Ledger rotation               | Later      | **DONE** (#1418)                                                                   |
| L5 AI map / WCAG / RPO-RTO       | Later      | **DONE / SATISFIED** (#985)                                                        |
| M1 Repo-host hardening           | Maintainer | OPEN (GitHub UI; audit §8; not a repo file)                                        |

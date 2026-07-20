# Maturity backlog — work orders

Living tracker that turns the deferred backlog from
[`docs/audit/2026-07-20-repository-maturity.md`](audit/2026-07-20-repository-maturity.md) §10
into actionable, sequenced work orders. Each item states its **outcome**, **approach**, **key
files**, **risk**, **verification**, and **status**. High-risk items are deliberately kept as
their own work order — the audit's rule is one dedicated PR + full-suite verification per
structural change, not a single mixed PR.

**Status legend:** `DONE` (landed) · `READY` (scoped, safe to start) · `OPEN` (needs a
decision or a dedicated PR) · `PROVIDER-GATED` (touches live DB/CI/provider — needs explicit
confirmation) · `SATISFIED` (already true in the repo; no work needed).

---

## Now — foundational, low-risk

### N1 · Dependabot grouping — `DONE`

- **Outcome:** fewer, batched dependency PRs instead of up to ~10/week for a solo maintainer.
- **Approach:** group npm minor/patch by dependency-type (production/development) and group all
  github-actions bumps; majors stay individual.
- **Files:** `.github/dependabot.yml`.
- **Risk:** none (config only).
- **Verification:** valid YAML; takes effect on the next Monday cadence.
- **Landed in:** this PR.

### N2 · Dependency-report workflow decision — `OPEN`

- **Outcome:** either an active fortnightly dependency report, or one less dormant workflow.
- **Approach:** `.github/workflows/dependency-report.yml` currently ships `workflow_dispatch`-only
  with its `schedule:` commented out. Choose: (a) uncomment the cron + run one dispatch to
  confirm the rolling issue renders, or (b) delete the workflow and rely on Dependabot alerts.
- **Risk:** low. It is report-only (`npm audit` + a rolling GitHub issue), but enabling a
  scheduled workflow that writes issues is a cadence/behaviour change, so it is left to the
  maintainer rather than flipped unilaterally.
- **Recommendation:** enable it (option a) — it restores intended functionality and complements
  Dependabot with an outdated-direct-deps view. Left `OPEN` pending your nod.

---

## Next — high-value maturity (each its own PR)

### X1 · Import-boundary ESLint rule — `READY` (with a correction)

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
- **Approach:** add a `no-restricted-imports` (patterns: `**/*mockup*`, `@/components/*-mockups`,
  `@/components/*-mockups/*`) block in `eslint.config.mjs`, scoped with an override that ignores
  `src/app/mockups/**` and the `src/components/**mockups**` sources themselves.
- **Files:** `eslint.config.mjs` (+ a short note in `docs/frontend-architecture.md`).
- **Risk:** low-medium — must not flag the legitimate `src/app/mockups/**` routes.
- **Verification:** `npm run lint` reports **0** new errors; add a deliberately-wrong import in a
  scratch file to confirm the rule fires, then remove it.

### X2 · `src/lib` domain-directory extraction — rag pilot — `OPEN`

- **Outcome:** the first real domain directory; unblocks directory-scoped boundary rules for the
  rest of `src/lib` (197 flat files).
- **Approach:** `git mv` the `rag*.ts` cluster (~23 files) into a new `rag/` directory under
  `src/lib/`; codemod `@/lib/rag*` importers; update the per-file paths in
  `scripts/check-maintainability-budgets.mjs`.
- **Files:** ~23 `src/lib/rag*.ts` + every importer + the budgets script + `docs/codebase-index.md`.
- **Risk:** HIGH — broad import churn; keep it isolated with no behaviour change.
- **Verification:** `npm run typecheck` && `npm run test`; diff must be pure moves + import-path
  rewrites (no logic changes).

### X3 · Decompose the monoliths — `OPEN`

- **Outcome:** shrink the three files the maintainability ratchet caps but never reduces:
  `src/lib/rag.ts` (5,143), `src/components/ClinicalDashboard.tsx` (4,270),
  `src/components/DocumentViewer.tsx` (3,166).
- **Approach:** extract cohesive units behind the existing budgets; `rag.ts` is the natural seam
  once X2 lands (its ~23 siblings already exist).
- **Risk:** HIGH (behavioural surface). One file per PR.
- **Verification:** `npm run typecheck` + `npm run test` (+ `npm run verify:ui` for the components).

### X4 · SAST-blocking on the parser/ingestion path — `PROVIDER-GATED (triage-first)`

- **Outcome:** Semgrep ERROR findings block on the untrusted-PDF surface, not just advise.
- **Approach:** add a path-scoped Semgrep job (targets `worker/**`, `src/lib/ingestion*`,
  `src/lib/extractors/**`, ingestion API routes) **without** `continue-on-error`. Triage the
  current advisory findings on those paths first so the gate starts green.
- **Files:** `.github/workflows/sast.yml`.
- **Risk:** MEDIUM — could block on pre-existing findings if not triaged first.
- **Verification:** a Semgrep run over the scoped paths reports zero ERROR before flipping the gate.

### X5 · ACL-migration consolidation review — `PROVIDER-GATED (DB owner)`

- **Outcome:** a settled grant model instead of repeated `repair/reassert/enforce` migrations
  (the 2026-07-19 cluster).
- **Approach:** DB-owner review of the repeated privilege-repair migrations; replace with a single
  canonical grant migration if the churn reflects an unsettled policy rather than genuine drift.
- **Files:** `supabase/migrations/*` (privilege-repair set), `supabase/schema.sql`, `docs/database-drift-detection.md`.
- **Risk:** HIGH (schema/live-DB semantics).
- **Verification:** `npm run check:drift` + the CI `db-reset-verify` replay; **live-DB work is
  confirmation-required** per the AGENTS.md provider boundary.

### X6 · Raise coverage floors for clinical domains — `OPEN`

- **Outcome:** higher targeted thresholds where correctness matters most (clinical-safety,
  retrieval, answer) than the current global 38–50%.
- **Approach:** add per-path coverage thresholds in `vitest.config.mts`; add the targeted tests
  needed to clear them (ratchet up, don't drop the bar retroactively).
- **Files:** `vitest.config.mts` (+ new `tests/*` specs).
- **Risk:** MEDIUM — needs real tests, not just a threshold bump.
- **Verification:** `npm run test:coverage` meets the new per-path floors.

---

## Later — useful, non-essential

### L1 · Archive one-shot scripts — `OPEN`

- **Outcome:** `scripts/` shows live tooling, not historical residue.
- **Approach:** once their migrations have shipped, move one-shots (`check:m13-migration`,
  `check:july8-live-batch`, completed dated `backfill:*`) to an `archive/` subfolder under
  `scripts/` and drop their `package.json` entries. Verify each migration is live before removing its checker.
- **Risk:** low (but confirm each is truly retired). **Companion (done):** the discoverability half
  of this item — a curated script map — ships now as
  [`docs/scripts-index.md`](scripts-index.md).

### L2 · Single-SHA-per-action uniformity — `OPEN`

- **Outcome:** every third-party action pinned to one SHA across all workflow + composite files.
- **Approach:** extend `scripts/check-github-action-pins.mjs` (it already parses every workflow)
  to assert one SHA per action name. Partly mitigated already by N1 (grouped action bumps land
  together).
- **Files:** `scripts/check-github-action-pins.mjs`.
- **Verification:** `npm run check:github-actions`.

### L3 · Single gate manifest — `OPEN`

- **Outcome:** `verify:cheap:internal` and CI's `static-pr` step list derive from one source so a
  gate can't be added to one and missed in the other.
- **Approach:** a small JS array of gate script names that `verify:cheap` iterates and a CI
  self-test asserts against `ci.yml`.
- **Files:** `package.json`, `.github/workflows/ci.yml`, a new gate-manifest script under `scripts/`.
- **Verification:** the self-test fails if the two lists diverge.

### L4 · Rotate the branch-review ledger — `OPEN`

- **Outcome:** `docs/branch-review-ledger.md` (361 KB, append-only) stays navigable.
- **Approach:** archive entries older than a quarter into `docs/archive/branch-review-ledger-<q>.md`;
  keep the live ledger to the current quarter.
- **Risk:** low.

### L5 · Documentation quick-wins — `DONE` / `SATISFIED`

- **AI tooling map** — `DONE` this PR: which of the five agent systems owns which job, in
  `docs/agents-guide.md`.
- **WCAG target** — `DONE` this PR: WCAG 2.2 AA named as the target in `docs/design-system.md` §7.
- **RPO/RTO** — `SATISFIED`: already documented in
  [`docs/disaster-recovery-runbook.md`](disaster-recovery-runbook.md) (the recovery-layers table),
  so the audit's "record RPO/RTO" item needs no new work.

---

## Not recommended (disproportionate for this repo)

A formal architecture-docs folder + numbered-ADR process · `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` /
`CHANGELOG.md` · microservice split · a second dependency bot · a new observability vendor · a
published OpenAPI/GraphQL contract (single internal client). Revisit the governance files only if
collaborators join — `AGENTS.md` + the PR template already carry that load.

---

## Progress summary

| Item                           | Priority | Status                                         |
| ------------------------------ | -------- | ---------------------------------------------- |
| N1 Dependabot grouping         | Now      | **DONE** (this PR)                             |
| N2 Dependency-report decision  | Now      | OPEN (recommend enable)                        |
| X1 Import-boundary linter      | Next     | READY (mockup rule; service-role rule dropped) |
| X2 `src/lib` rag extraction    | Next     | OPEN (isolated PR)                             |
| X3 Monolith decomposition      | Next     | OPEN                                           |
| X4 SAST-blocking on parser     | Next     | PROVIDER-GATED (triage-first)                  |
| X5 ACL-migration consolidation | Next     | PROVIDER-GATED (DB owner)                      |
| X6 Coverage floors             | Next     | OPEN                                           |
| L1 Archive one-shot scripts    | Later    | OPEN (index shipped)                           |
| L2 Action-SHA uniformity       | Later    | OPEN (mitigated by N1)                         |
| L3 Single gate manifest        | Later    | OPEN                                           |
| L4 Ledger rotation             | Later    | OPEN                                           |
| L5 AI map / WCAG / RPO-RTO     | Later    | **DONE / SATISFIED**                           |

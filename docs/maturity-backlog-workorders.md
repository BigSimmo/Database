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

### X3 · Decompose the monoliths — `OPEN` (first extraction landed #997)

- **Outcome:** shrink the three files the maintainability ratchet caps but never reduces:
  `src/lib/rag/rag.ts` (5,018), `src/components/ClinicalDashboard.tsx` (4,271),
  `src/components/DocumentViewer.tsx` (3,164).
- **Progress (#997):** extracted the evidence-gate predicates from `rag.ts` into
  `src/lib/rag/rag-evidence-gates.ts` (rag.ts 5,147 → 5,018), pure moves behind the existing
  budgets. The two components are untouched and remain the largest open decomposition targets.
- **Approach:** extract cohesive units behind the existing budgets; `rag.ts` is the natural seam
  now that X2 has landed (its ~23 siblings already exist).
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

### L4 · Rotate the branch-review ledger — `OPEN`

- **Outcome:** `docs/branch-review-ledger.md` (361 KB, append-only) stays navigable.
- **Approach:** archive entries older than a quarter into `docs/archive/branch-review-ledger-<q>.md`;
  keep the live ledger to the current quarter.
- **Risk:** low.

### L5 · Documentation quick-wins — `DONE` / `SATISFIED`

- **AI tooling map** — `DONE` (#985): which of the five agent systems owns which job, in
  `docs/agents-guide.md`.
- **WCAG target** — `DONE` (#985): WCAG 2.2 AA named as the target in `docs/design-system.md` §7.
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

| Item                           | Priority | Status                                     |
| ------------------------------ | -------- | ------------------------------------------ |
| N1 Dependabot grouping         | Now      | **DONE** (#985)                            |
| N2 Dependency-report decision  | Now      | **DONE** (#986, enabled)                   |
| X1 Import-boundary linter      | Next     | **DONE** (#986; service-role rule dropped) |
| X2 `src/lib` rag extraction    | Next     | **DONE** (#994)                            |
| X3 Monolith decomposition      | Next     | OPEN (first extraction landed #997)        |
| X4 SAST-blocking on parser     | Next     | **DONE** (gate + policy check)             |
| X5 ACL-migration consolidation | Next     | PROVIDER-GATED (DB owner)                  |
| X6 Coverage floors             | Next     | OPEN                                       |
| L1 Archive one-shot scripts    | Later    | OPEN (index shipped)                       |
| L2 Action-SHA uniformity       | Later    | **DONE** (#992)                            |
| L3 Single gate manifest        | Later    | **DONE** (#1002)                           |
| L4 Ledger rotation             | Later    | OPEN                                       |
| L5 AI map / WCAG / RPO-RTO     | Later    | **DONE / SATISFIED** (#985)                |

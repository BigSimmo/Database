# Repository maturity audit — 2026-07-20

Point-in-time record. Full-repository maturity, mapping, and organisation review of
Clinical KB (`psychiatry.tools`). Scope: structure, architecture, docs, DX, testing,
security, CI/CD, release, operations, governance. Read-and-assess pass with a small set of
**safe, reversible** changes applied in the same PR (see [§6](#6-changes-made-this-pass));
higher-risk structural work is deferred to the backlog ([§10](#10-prioritised-backlog))
rather than forced.

Companion maps (authoritative, not duplicated here): `docs/codebase-index.md` (module map),
`docs/site-map.md` (routes), `docs/deployment-architecture.md` (topology),
`docs/frontend-architecture.md`, `docs/ingestion-state-machine.md`.

---

## 1. Executive summary

Clinical KB is a **single-maintainer** (`@BigSimmo`, per `.github/CODEOWNERS`) private
clinical RAG application: a local-first medical-guideline knowledge base that ingests
private reference documents, indexes text + image captions into pgvector, and answers
questions with citations linking back to the source PDF.

**Overall maturity: High** — well above the bar for a project of this size. It is arguably
a model repository. The strongest domains are CI/CD, security, data/migrations, testing,
dependency hygiene, and documentation, all of which are already at or above industry median
for much larger teams. This audit therefore found **few real gaps and a genuine risk of
over-engineering** — the correct posture here is pruning, indexing, and diagram-adding, not
adding scaffolding.

**Most important risks (the one High-priority gap — a missing security-reporting policy,
row 35 — is closed in this PR; all remaining open risks are Medium or lower):**

1. **Navigability of the code**, not the docs: `src/lib` is 197 flat `.ts` files organised
   by filename prefix, and module boundaries are enforced by convention + ad-hoc scripts,
   not by an import linter. Two true monoliths (`rag.ts` 5,143 lines,
   `ClinicalDashboard.tsx` 4,270) are capped by a maintainability ratchet but not reduced.
2. **Command/tooling surface volume**: 166 npm scripts and ~135 `scripts/` files, plus five
   overlapping AI-assistant systems (Codex, Claude, Cursor, CodeRabbit, `.agents/`). Powerful
   but undiscoverable and hard for one person to keep coherent.
3. **Documentation sprawl** (being corrected this pass): the repo's own "move superseded docs
   to `archive/`" rule was not being followed for ~several completed dated docs.
4. **One genuinely-missing governance file**: no `SECURITY.md` for a clinical app that
   already maintains substantial threat models (added this pass).

**Applied this pass (safe):** `SECURITY.md` + README security/license notes; Mermaid
architecture/ingestion/answer-flow diagrams (there were previously **zero** diagrams
anywhere); documentation-index fixes + a conservative archive of completed docs; corrected
two stale self-descriptions (a CI-coverage-script comment, the bundle-budget CI label);
declared the proprietary license. No source, API, schema, auth, or deployment behaviour was
changed.

**Deferred (documented):** `src/lib` domain-directory migration, monolith decomposition,
an import-boundary linter, SAST-blocking on the untrusted-PDF parser path, Dependabot
grouping, one-shot-script archival — see [§10](#10-prioritised-backlog).

---

## 2. Detected project profile

| Aspect             | Detail (evidence)                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose            | Private clinical-guideline RAG knowledge base for a psychiatrist (Perth, AU); grounded Q&A with source-linked citations (`README.md`).          |
| Languages          | TypeScript (app/scripts/worker), SQL (Supabase migrations), Python (OCR worker), Deno/TS (edge functions).                                      |
| Framework          | Next.js 16 (App Router), React 19 (`docs/codebase-index.md`).                                                                                   |
| Runtime            | Node 24.x / npm 11.x, pinned at 4 layers (`.nvmrc`, `.node-version`, `engines`, `packageManager`) + `engine-strict`.                            |
| Package managers   | npm (app; `package-lock.json`) and Deno (edge functions only; `deno.lock`) — cleanly partitioned.                                               |
| Data tier          | Supabase — Postgres 17 + pgvector, Storage (private buckets), Auth; region ap-southeast-2 (Sydney). 178 migrations, 38 RLS tables, 47 policies. |
| External APIs      | OpenAI (embeddings, image captions, grounded answers).                                                                                          |
| Ingestion          | Railway `worker` container (PyMuPDF/Tesseract OCR) + Supabase `indexing-v3-agent` edge function (cron gate).                                    |
| Build/bundle       | `next build` (guarded), esbuild for worker; bundle-size budget (`bundle-budget.json`, enforced).                                                |
| Tests              | Vitest (node + jsdom projects, 344 files) + Playwright (production/mockup/visual/a11y). Golden RAG fixtures; flake ledger.                      |
| Quality tools      | Prettier, ESLint 9 (flat, 1 custom rule), tsc `--noEmit`, Knip (dead code), one-per-responsibility.                                             |
| CI/CD              | GitHub Actions — 16 workflows, SHA-pinned, least-privilege, concurrency-cancelled, change-scoped; real CI/local parity.                         |
| Deploy             | Railway (Singapore) — `Database` app tier → `https://psychiatry.tools`, `worker` service; auto-deploy on `main`.                                |
| Security           | Zod-validated env + fail-closed startup, RLS + live drift detection, cross-tenant regression harness, Gitleaks + Semgrep, threat models + PIA.  |
| Dependency updates | Dependabot (npm + actions, weekly). No Renovate (no bot collision).                                                                             |
| Team               | Single maintainer; `CODEOWNERS` routes high-risk surfaces and anticipates collaborators.                                                        |

---

## 3. Current repository map

The authoritative map is `docs/codebase-index.md` (kept honest by
`npm run docs:check-index`, which fails CI when a top-level module/route is missing). This
pass added visual diagrams (previously none existed):

- **Deployment / container topology** — `docs/deployment-architecture.md` → "Topology at a glance".
- **Ingestion document lifecycle (state diagram)** — `docs/ingestion-state-machine.md` → "Lifecycle at a glance".
- **Answer / RAG request flow (sequence diagram)** — `docs/codebase-index.md` → RAG section.

Annotated top level:

| Path              | Purpose                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `src/app/`        | Next.js App Router — 19 route groups + 38 API route handlers.                                             |
| `src/components/` | 15 component domains (4 are `*-mockups`) + `ui/` primitives.                                              |
| `src/lib/`        | Shared library — 197 flat `.ts` (prefix-namespaced) + `extractors/ observability/ supabase/ validation/`. |
| `worker/`         | Ingestion/OCR worker (Node + `worker/python/`).                                                           |
| `supabase/`       | 178 migrations, `schema.sql` mirror, RLS/RPCs, edge functions, drift manifest.                            |
| `scripts/`        | ~135 CLI ops/guards/evals/backfills + runner wrappers (`run-heavy.mjs`, `run-tsx.mjs`).                   |
| `tests/`          | 344 Vitest + 14 Playwright specs (flat, prefix-grouped).                                                  |
| `docs/`           | Maintained reference + point-in-time records + `archive/`.                                                |
| `.github/`        | 16 workflows, composite actions, CODEOWNERS, PR template, Dependabot.                                     |

Request/data flows: **Answer** = client → `/api/answer` → `rag.ts` → hybrid retrieval RPCs
→ ranking → OpenAI generation → verification → cited response (see the new sequence
diagram). **Ingestion** = upload → Storage + `ingestion_jobs` → worker extract/OCR/chunk/
embed → pgvector; atomic reindex generations (see the new state diagram).

---

## 4. Maturity gap matrix

Priority: Critical / High / Medium / Low. Status: **Done** (this pass) / **Backlog** / **No
action** (already sufficient). Effort: S/M/L.

| #   | Domain                        | Current state & evidence                                                                             | Gap / risk                                                                  | Recommendation                                                                      | Priority | Effort | Status                |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- | ------ | --------------------- |
| 1   | Repo structure / navigability | Clear top level; excellent `codebase-index.md` (coverage-enforced).                                  | `src/lib` 197 flat files; ~135 undocumented scripts.                        | Domain dirs (backlog); scripts index.                                               | Medium   | M      | Backlog               |
| 2   | Architecture / modularity     | Prefix-namespaced domains; clean API nesting; fail-closed startup.                                   | No directory-level domains; 2 monoliths.                                    | Lift prefixes to `src/lib/<domain>/`; decompose `rag.ts`.                           | Medium   | L      | Backlog               |
| 3   | Domain boundaries             | Boundaries in prose + guards (`check:owner-scope`, `check:client-bundle-secrets`).                   | No import-boundary linter — cross-domain import passes CI silently.         | Add `no-restricted-imports`/`eslint-plugin-boundaries` for 2 documented invariants. | Medium   | S–M    | Backlog               |
| 4   | Frontend organisation         | Feature-grouped components; shared `ui/`; documented composer rules.                                 | `ClinicalDashboard.tsx` 4,270 lines.                                        | Decompose behind the maintainability budget.                                        | Medium   | L      | Backlog               |
| 5   | Backend organisation          | RESTful API routes; health/ready split; SSE answer route separated.                                  | —                                                                           | —                                                                                   | —        | —      | No action             |
| 6   | API contracts                 | Zod validation on request surfaces; typed responses.                                                 | No published OpenAPI (internal single-client app — low value).              | Optional only.                                                                      | Low      | M      | No action             |
| 7   | Data modelling / migrations   | 178 timestamped migrations, monotonic; drift manifest + allowlist; expand-contract discipline.       | Recent ACL-repair migration churn (repeated reassert/repair 2026-07-19).    | DB-owner review to settle the grant model.                                          | Medium   | M      | Backlog               |
| 8   | Configuration mgmt            | Zod `env.ts` (server-only) + `client-env.ts`; cross-checks; `.env.example` clean.                    | —                                                                           | —                                                                                   | —        | —      | No action             |
| 9   | Code quality                  | Prettier + ESLint 9 (1 documented custom rule) + tsc strict; Knip.                                   | —                                                                           | —                                                                                   | —        | —      | No action             |
| 10  | Type safety                   | `strict: true`, `noImplicitReturns`; generated DB types.                                             | `skipLibCheck` (standard, pragmatic).                                       | —                                                                                   | Low      | —      | No action             |
| 11  | Testing                       | 344 tiered Vitest + Playwright; golden RAG fixtures; property tests; flake ledger.                   | Coverage floors 38–50% modest for clinical safety; flat `tests/`.           | Raise targeted floors on clinical/retrieval/answer domains.                         | Medium   | M      | Backlog               |
| 12  | Onboarding                    | Verified quick start in `README.md`; `agents-guide.md`; demo-mode fallback.                          | —                                                                           | —                                                                                   | —        | —      | No action             |
| 13  | Local dev experience          | Project-stable port picker; `npm run ensure`; heavy-command lock.                                    | —                                                                           | —                                                                                   | —        | —      | No action             |
| 14  | Documentation                 | Maintained index; machine-enforced coverage + link checks; strong governance docs.                   | Index over-claimed "everything"; sprawl; no diagrams.                       | Fix index; archive completed docs; add diagrams.                                    | Medium   | S      | **Done**              |
| 15  | Design system / UX docs       | `design-system.md`, badge/composer guides; token/type/icon guards.                                   | —                                                                           | —                                                                                   | —        | —      | No action             |
| 16  | Accessibility                 | Custom lucide-aria ESLint rule; `ui-accessibility.spec.ts`; forced-colors/reduced-motion tests.      | No stated WCAG target level.                                                | Note WCAG 2.2 AA target in `design-system.md`.                                      | Low      | S      | Backlog               |
| 17  | Dependency mgmt               | Dependabot (npm + actions), weekly; `overrides` pins; allow-scripts gating.                          | No `groups:` → up to 10 PRs/week; `dependency-report.yml` shipped disabled. | Add Dependabot groups; enable or delete the dormant report.                         | Medium   | S      | Backlog               |
| 18  | Supply-chain security         | SHA-pinned actions (self-enforced), lockfiles, least-privilege, non-root slim worker image.          | Action-version skew across files (setup-node v5/v7).                        | Extend pin checker to enforce single SHA per action.                                | Low      | S      | Backlog               |
| 19  | Application security          | Validated input, auth epoch/abort lifecycle, RLS, cross-tenant harness, secure headers/CSP nonce.    | SAST advisory-only on an untrusted-PDF parser.                              | Make Semgrep ERROR blocking on parser/ingestion paths.                              | Medium   | M      | Backlog               |
| 20  | Secret management             | Clean `.env.example` (placeholders); Gitleaks full-history; `check:client-bundle-secrets`.           | —                                                                           | —                                                                                   | —        | —      | No action             |
| 21  | CI                            | 16 workflows, cached, timed, concurrency-cancelled, least-privilege, change-scoped; CI/local parity. | Gate list duplicated (verify chain vs CI step list).                        | Derive both from one manifest, or add a parity self-test.                           | Low      | S      | Backlog               |
| 22  | CD / deployment               | Railway auto-deploy from `main`; healthcheck path; rollback docs.                                    | —                                                                           | —                                                                                   | —        | —      | No action             |
| 23  | Release management            | Continuous deploy from `main`; no versioned releases (appropriate).                                  | No `CHANGELOG` (N/A for continuous deploy).                                 | —                                                                                   | —        | —      | No action             |
| 24  | Observability                 | `observability/` SLO/cache/spend snapshots; deep-health probes; loud-failure bias.                   | —                                                                           | —                                                                                   | —        | —      | No action             |
| 25  | Reliability / ops readiness   | Health/ready endpoints; graceful degradation; bounded retries/backoff; leases.                       | No heartbeat on ingestion lease (documented, acceptable).                   | —                                                                                   | Low      | —      | No action             |
| 26  | Backup / restore / DR         | `disaster-recovery-runbook.md`; Supabase managed backups.                                            | RPO/RTO not numerically stated.                                             | Record RPO/RTO targets when known.                                                  | Low      | S      | Backlog               |
| 27  | Incident response             | `governance-incident-runbooks.md`, rollback runbooks.                                                | —                                                                           | —                                                                                   | —        | —      | No action             |
| 28  | Performance                   | Bundle budget (enforced), retrieval latency evals, capacity review.                                  | —                                                                           | —                                                                                   | —        | —      | No action             |
| 29  | Ownership / governance        | `CODEOWNERS` with high-risk overrides; PR template with clinical preflight.                          | —                                                                           | —                                                                                   | —        | —      | No action             |
| 30  | Privacy / compliance          | PIA, cross-border basis, query-privacy, owner scoping, SaMD notes.                                   | —                                                                           | —                                                                                   | —        | —      | No action             |
| 31  | Licensing / attribution       | `private: true`; ownership known (proprietary).                                                      | No `license` field / statement.                                             | Declare `UNLICENSED` + README note.                                                 | Low      | S      | **Done**              |
| 32  | AI-assisted dev instructions  | Canonical `AGENTS.md`; `CLAUDE.md` is a non-dup import; `agents-guide.md` anti-drift pointer.        | Five overlapping agent systems for one maintainer.                          | Add an "AI tooling map" naming which system owns which job; prune before growing.   | Low      | S      | Backlog               |
| 33  | Technical-debt mgmt           | Maintainability-budget ratchet; `process-hardening.md`; flake ledger.                                | Debt tracked across many docs.                                              | —                                                                                   | Low      | —      | No action             |
| 34  | Repo-host configuration       | Branch protection / rulesets live in GitHub UI.                                                      | Not captured in-repo.                                                       | See [§8](#8-repository-host-manual-actions-checklist).                              | Medium   | S      | **Done** (documented) |
| 35  | Security-reporting policy     | Substantial threat models, but no `SECURITY.md`.                                                     | No private disclosure channel surfaced.                                     | Add `SECURITY.md`.                                                                  | **High** | S      | **Done**              |

---

## 5. Target repository structure

The current structure is **right-sized and framework-idiomatic**; no top-level reorg is
recommended. Keep the flat `docs/` with its maintained/point-in-time/archive discipline (do
**not** introduce a `docs/architecture/` folder + formal ADR process — ceremony this
single-maintainer repo does not need). Keep the one-package npm layout (no monorepo split).

The one aspirational structural change (backlog, not now) is inside `src/lib`, converting
the filename-prefix pseudo-namespaces into real directories so an import linter can enforce
boundaries:

```text
src/lib/rag/        ← rag*.ts, smart-rag-api.ts, retrieval-*, ranking-*   (start here: rag.ts is the seam)
src/lib/answer/     ← answer-*.ts
src/lib/ingestion/  ← ingestion*.ts, reindex-*.ts, chunking.ts
src/lib/documents/  ← document-*.ts, source-*.ts
(unchanged: extractors/ observability/ supabase/ validation/)
```

Migration map (per cluster, independently verifiable): `git mv` the cluster → update
`@/lib/*` imports (codemod) → run `typecheck` + `test` → add the `no-restricted-imports`
zone for that directory → commit. One cluster per PR; `rag/` first. Risk: high import churn
— this is why it is **deferred**, not done here.

---

## 6. Changes made (this pass)

All changes are documentation or non-behavioural config. No source logic, API, schema, auth,
retrieval, or deployment behaviour changed.

| Change                | Files                                                                                          | Purpose                                                                               | Risk                             | Verification                                |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------- |
| Security policy       | `SECURITY.md` (new), `README.md`                                                               | Private vulnerability-reporting channel + threat-model links.                         | None (new doc).                  | Rendered; links resolve.                    |
| License declaration   | `package.json`, `README.md`                                                                    | Declare proprietary (`"license":"UNLICENSED"`).                                       | None.                            | `format:check`, valid JSON.                 |
| Architecture diagrams | `docs/deployment-architecture.md`, `docs/ingestion-state-machine.md`, `docs/codebase-index.md` | First visual maps (topology, ingestion states, answer flow).                          | None (docs).                     | Standard Mermaid; `docs:check-links`.       |
| Doc index fix         | `docs/README.md`                                                                               | Add 7 orphaned living docs; soften "everything" over-claim.                           | None.                            | `docs:check-links`.                         |
| Conservative archive  | `git mv` ×5 → `docs/archive/`                                                                  | Follow the repo's own "move superseded docs" rule; declutter root.                    | Low (renames; links retargeted). | `docs:check-links` (936 refs).              |
| Stale-comment fix     | `scripts/check-codebase-index-coverage.mjs`                                                    | Comment claimed "Not in CI"; it runs in CI + `verify:cheap`.                          | None.                            | Verified wiring in `ci.yml`/`package.json`. |
| Bundle-budget truth   | `.github/workflows/ci.yml`, `scripts/check-bundle-budget.mjs`                                  | Label/docstring said "warn-only"; budget is now enforced (`enforce:true` + baseline). | None.                            | Read `check-bundle-budget.mjs` logic.       |

Archived (with reasons): `project-alignment-cleanup.md`, `source-governance-priorities-2026-07-02.md`,
`source-governance-status-2026-07-08.md` (completed, index already labelled them historical);
root `BRANCH_ARCHIVE_20260709.md` and `design-qa.md`→`design-qa-2026-07-15.md` (ephemeral
docs parked at repo root). **Deliberately not moved:** `source-review-priority-2026-07-02.md`
— it is referenced by the live governance-debt manifest `release-source-metadata-debt-2026-06-30.json`,
so moving it would break a live path.

---

## 7. Verification results

Changes are docs + non-behavioural config, so the relevant gates are the docs/format/runtime
checks. The full `lint`/`typecheck`/`test`/`build` suite was **not** run (no source/behaviour
change) and will run on the PR via CI; this is stated honestly rather than claimed.

| Check                   | Command                      | Result                                                    |
| ----------------------- | ---------------------------- | --------------------------------------------------------- |
| Doc link integrity      | `npm run docs:check-links`   | **Pass** — 936 repo path references resolve.              |
| Doc script refs         | `npm run docs:check-scripts` | **Pass** — 305 `npm run` references resolve.              |
| Codebase-index coverage | `npm run docs:check-index`   | **Pass** — 38 modules/routes + all schema tables indexed. |
| Formatting              | `npm run format:check`       | **Pass** — all files Prettier-clean.                      |
| Runtime                 | `npm run check:runtime`      | **Pass** — Node 24.13.0 / npm 11.6.2.                     |

Baseline: no pre-existing failures were introduced or masked; the working tree was clean at
the start of this pass. Mermaid diagrams use standard GitHub-native syntax (the Mermaid
validation MCP tool required interactive approval unavailable in this run, so syntax was
verified by hand and will render on GitHub).

---

## 8. Repository-host manual actions checklist

These live in GitHub settings, not in the repo, and require the maintainer (not a file
change). Confirm/enable as appropriate:

- **Branch protection / ruleset on `main`**: require the `pr-required` aggregate check + Gitleaks; require PR before merge; no force-push; (optionally) require CODEOWNERS review on high-risk paths.
- **Required status checks**: pin to the always-reporting `pr-required` aggregate + Gitleaks (matches `README.md`/CI design).
- **Private vulnerability reporting**: enable under Security → Advisories (this is the channel `SECURITY.md` points to).
- **Secret scanning + push protection**: enable (complements the Gitleaks CI workflow).
- **Dependabot alerts / security updates**: enable (config already present for version updates).
- **Auto-delete merged branches**: enable (reduces stale-branch load; aligns with the branch-cleanup guide).
- **Merge method**: confirm squash-merge is the enforced method (matches the auto-merge/`prlanded` workflow).
- **Environment protections** (Railway deploy): confirm production requires the intended approvals/secrets; secrets stored in Railway/GitHub, never in-repo.
- **Tag/release protection**: low priority (no versioned releases today).
- **Actions permissions**: confirm workflow token defaults are least-privilege (in-repo workflows already set `contents: read` top-level).

---

## 9. Risks and assumptions

**Confirmed (evidence in-repo):** single maintainer; Next.js 16/React 19/Supabase/OpenAI/
Railway stack; 178 migrations; 16 CI workflows; SHA-pinned least-privilege CI; clean
`.env.example`; no `SECURITY.md`/`license` before this pass; zero Mermaid diagrams before
this pass.

**Reasonable inferences:** the ACL-repair migration cluster (2026-07-19) suggests the grant
model is being corrected iteratively; the five AI-assistant systems create maintenance-drift
risk for one person. Neither is a defect — both are flagged for owner judgement.

**Unknowns / not verified:** live Railway/Supabase/GitHub host settings (§8) were not
inspected (out of scope, provider-confirmation boundary); RPO/RTO numbers; whether the
one-shot scripts (`check:m13-migration`, `check:july8-live-batch`) are still needed.

**Deferred high-risk changes (not attempted):** `src/lib` restructure, monolith
decomposition, import-boundary linter, SAST-blocking — each needs its own PR and full-suite
verification.

---

## 10. Prioritised backlog

Each item: outcome · rationale · scope · risk · verification.

### Now (foundational / low-risk, worth doing soon)

- **Dependabot `groups:`** — outcome: fewer, batched dependency PRs. Rationale: up to 10
  PRs/week for a solo maintainer; each triggers full CI. Scope: `.github/dependabot.yml`
  (group `github-actions`; group `@types/*` + non-major npm). Risk: low. Verify: Dependabot
  dry-run / next cycle.
- **Decide `dependency-report.yml`** — enable the schedule or delete the dormant workflow
  (currently `workflow_dispatch`-only). Scope: 1 file. Risk: low. Verify: manual dispatch.

### Next (high-value maturity)

- **Import-boundary linter** — outcome: prose invariants become CI gates. Scope: add
  `no-restricted-imports` zones — (a) `src/app/**` must not import `**/*mockup*`, (b) only
  `src/lib/supabase/admin.ts` imports the service-role client. Risk: low-medium (may surface
  existing violations). Verify: `lint`.
- **`src/lib/rag/` extraction (pilot)** — outcome: first real domain directory + boundary
  rule; unblocks the rest. Scope: `git mv` the `rag*` cluster, codemod imports. Risk: high
  churn (isolated PR). Verify: `typecheck` + `test`.
- **SAST-blocking on parser/ingestion paths** — outcome: untrusted-PDF surface fails on
  Semgrep ERROR. Scope: `sast.yml` path filter + triage existing findings first. Risk:
  medium. Verify: `sast` run.
- **ACL-migration consolidation review** — outcome: a settled grant model instead of repeated
  repair migrations. Scope: DB-owner review of the 2026-07-19 cluster. Risk: medium (schema).
  Verify: `check:drift`, `db-reset-verify`.
- **Raise coverage floors** on clinical-safety/retrieval/answer domains. Scope:
  `vitest.config.mts` per-path thresholds. Risk: low. Verify: `test:coverage`.

### Later (useful, non-essential)

- **`scripts/` index + archive one-shots** (`check:m13-migration`, `check:july8-live-batch`,
  completed backfills) once their migrations have shipped.
- **`ClinicalDashboard.tsx` decomposition** behind the maintainability budget.
- **Single-SHA-per-action uniformity** enforced by the pin checker.
- **Rotate `docs/branch-review-ledger.md`** (361 KB, append-only) by quarter.
- **Record RPO/RTO** in the DR runbook when known; note the **WCAG 2.2 AA** target in
  `design-system.md`.
- **"AI tooling map"** in `AGENTS.md`/`agents-guide.md` naming which of the five agent systems
  owns which job (so the overlap is intentional-by-record); prune before adding more skills.
- **Single gate manifest** feeding both `verify:cheap` and CI's `static-pr` step list.

### Not recommended (disproportionate for this repo)

- Formal `docs/architecture/` folder + numbered ADR process.
- `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `CHANGELOG.md` (single maintainer, continuous
  deploy; `AGENTS.md` + PR template already carry the load — revisit if collaborators join).
- Microservice split, additional dependency bot, or new observability vendor.
- Published OpenAPI/GraphQL contract (single internal client).

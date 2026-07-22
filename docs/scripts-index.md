# Scripts index

Curated map of `scripts/` (~135 files) and the `package.json` script surface (~166 entries),
grouped by purpose. This is orientation, not an exhaustive per-file listing — the authoritative
command list is `package.json`, and `npm run docs:check-scripts` verifies every `npm run <x>`
referenced in docs resolves to a real script.

Legend: **[live]** routine tooling · **[infra]** runner/guard plumbing · **[one-shot]** completed
migration/batch helper that is a candidate for an `archive/` subfolder under `scripts/` once its
migration has shipped (see `docs/maturity-backlog-workorders.md` L1).

## Runner & guard infrastructure [infra]

| Script                                                                                     | Role                                                                                                        |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `run-heavy.mjs`                                                                            | Serializes heavy jobs behind a cross-process lock (`test-run-lock.mjs`) so builds/tests don't oversubscribe |
| `run-tsx.mjs`, `run-vitest.mjs`, `run-playwright.mjs`, `run-eval-safe.mjs`                 | Typed/test/e2e/eval entrypoint wrappers                                                                     |
| `dev-free-port.mjs`, `ensure-local-server.mjs`                                             | Project-stable localhost port selection + background server ensure                                          |
| `check-node-engine.cjs`, `install-git-hooks.mjs`, `guard-push.mjs`, `guard-next-build.mjs` | Install/preflight guards                                                                                    |
| `ci-change-scope.mjs`, `ci-triage.mjs`, `pr-policy.mjs`                                    | CI change classification + PR policy (self-tested via `check:ci-scope`/`check:ci-triage`/`check:pr-policy`) |
| `child-process-result.mjs`, `cli-utils.ts`, `productivity-core.mjs`                        | Shared helpers                                                                                              |

## Verification gates [live]

`verify:cheap` → `verify:pr-local` → `verify:ui` → `verify:release`. Building blocks:
`check-runtime.ts`, `check-github-action-pins.mjs`, `check-gate-manifest.mjs`,
`check-maintainability-budgets.mjs`, `check-codebase-index-coverage.mjs`, `check-docs-links.mjs`,
`check-docs-script-refs.mjs`, `check-bundle-budget.mjs`, `check-type-scale.mjs`,
`check-icon-scale.mjs`, `check-design-system-contract.mjs`, `check-function-grants.mjs`,
`check-owner-scope-api.mjs`, `check-client-bundle-secrets.mjs`, `verify-pr-local.mjs`,
`verify-release-offline.mjs`. `check-gate-manifest.mjs` cross-checks that every gate in the
`verify:cheap:internal` chain also runs in CI's `static-pr` job, so the two lists can't drift.

## Ingestion, indexing & reindex [live]

`import-documents.ts`, `reindex.ts`, `reindex-health.ts`, `check-indexing.ts`,
`recover-ingestion-queue.ts`, `cleanup-abandoned-reindex-generations.ts`,
`ingestion-autopilot.ts`, `backfill-smart-index.ts`.

## Document intelligence & governance [live]

`enrich-documents.ts`, `classify-documents.ts`, `backfill-gold-document-labels.ts`,
`audit-source-governance.ts`, `check-document-label-coverage.ts`,
`check-document-label-governance.ts`, `promote-public-documents-batch.ts`,
`audit-public-document-approvals.ts`, `production-readiness.ts`, `check-supabase-project.ts`,
`check-default-acl.ts`, `check-drift.ts`, `generate-drift-manifest.ts`,
`check-migration-history-alignment.ts`.

## RAG evaluation [live]

`eval-rag.ts`, `eval-rag-offline.mjs`, `eval-retrieval.ts`, `eval-quality.ts`,
`eval-answer-quality.ts`, `eval-search.ts`, `eval-search-api.ts`, `eval-assertions.ts`,
`compare-retrieval-eval.ts`, `retrieval-health.ts`, `profile-retrieval-rpcs.ts`,
`warm-retrieval-cache.ts`, `tune-search-weights.ts`, `check-rag-fixtures.mjs`. Golden fixtures:
`scripts/fixtures/rag-retrieval-golden.json`, `scripts/fixtures/assertion-golden.json`.

## Registry / catalogue content [live]

`seed-registry-records.ts`, `embed-registry-records.ts`, `reconcile-registry-governance.ts`,
`import-services-export.ts`, `import-differentials-export.ts`, `seed-differential-records.ts`,
`import-medications-export.ts`, `seed-medication-records.ts`.

## Build & assets [live/infra]

`build-worker.mjs`, `build-analyze.mjs`, `build-therapies-index.mjs`, `build-ranking-snapshot.ts`,
`generate-site-map.ts`, `generate-brand-assets.ts`, `generate-sample-documents.ts`,
`check-sample-extraction.ts`.

## Maintenance & ops [live]

`cleanup-storage.ts`, `purge-query-logs.ts`, `audit-tables.ts`, `supabase-recovery-status.ts`,
`promote-query-misses.ts`, `flake-ledger.mjs`, `sweep-branch-ledger.mjs`, `dependency-report.mjs`,
`set-site-administrator.ts`.

## One-shot / dated — archive candidates [one-shot]

Completed migration/batch helpers kept only for provenance; retire to the `scripts/archive/`
subfolder once the underlying migration is confirmed live (work order L1).

**Already archived** (in `scripts/archive/`, still runnable as live-DB re-verification probes via
`npm run check:m13-migration` / `npm run check:july8-live-batch`): `check-m13-migration.ts`,
`check-july8-live-batch.ts`. Their `.test.ts` companion lives in `scripts/archive/` too so it stays
out of the `tests/**` run.

**Remaining candidates** (still in `scripts/`, retire once each is confirmed retired):
`check-retrieval-owner-migration.ts`, `backfill-source-metadata.ts`, `backfill-text-normalization.ts`,
`backfill-visual-intelligence.ts`, `backfill-document-tags.ts`, `backfill-enrichment.ts`,
`derive-unknown-status.ts`, `reindex-image-generation-metadata.ts`, `measure-wrapped-dose-prevalence.ts`.

## Workflow planners [infra]

`external-workflow.mjs` (`workflow:run/status/verify/deps/clean-state/export/handoff`) and
`productivity-workflow.mjs` (`workflow:flightplan/triage/clinical-proof/design-sweep/rag-lab/
operator-closeout/lifecycle`) — see `docs/productivity-workflows.md`.

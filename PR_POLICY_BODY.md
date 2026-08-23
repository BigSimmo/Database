## Summary

- Harden the staging soak as authenticated, redirect-refusing, production-denying release evidence with enforceable latency, error, throttling, and authentication thresholds.
- Bind the cross-tenant staging workflow to the exact deployed candidate SHA before any client creation or fixture write, and record checkout/deployed SHAs in evidence.
- Keep both live-drift diagnostics visible, correct the migration remedy, update current database/privacy/release documentation, and queue immutable ledger corrections for #057 and #231.
- Revalidated the maturity report's two stale P0 premises: production/staging migration history is already aligned at 211 versions through 20260820120000, and the existing fast-route generation deadline already reserves 2 seconds below the 25-second outer budget.

## Verification

- [ ] `npm run verify:pr-local`

Verification not run: Work Mode rejected the outstanding-ledger umbrella command earlier in this task, so `verify:pr-local` and `verify:cheap` were not retried indirectly. Hosted CI runs the canonical aggregate gates.

- [x] Focused Vitest: 74 tests across 7 files
- [x] Full TypeScript check
- [x] Changed-file ESLint
- [x] Documentation links and npm-script references
- [x] Codebase index and docs inventory
- [x] GitHub Action pin and gate-manifest checks
- [x] Changed-file formatting and `git diff --check`
- [x] Outstanding-issues generated snapshot check
- [x] Branch review ledger guard and self-tests
- [ ] `npm run verify:ui`

UI verification not run: no UI, routing, styling, or browser behavior changed.

- [ ] `npm run verify:release`

Verification not run: this requires an exact deployed candidate plus explicitly authorized staging/provider activity. The patch makes that future evidence stricter but does not claim it ran.

- [ ] `npm run eval:retrieval:quality`

Verification not run: no retrieval, ranking, selection, chunking, scoring, or answer behavior changed.

- [ ] `npm run check:production-readiness`
- [ ] `npm run check:deployment-readiness`

Verification not run locally: no production/provider mutation was authorized. Focused offline checks cover the changed release tooling and documentation; the first hosted CI run passed its CI-safe production-readiness and offline RAG contract jobs.

## Risk and rollout

- Risk: Low to moderate. Operational evidence becomes deliberately stricter, so anonymous, redirecting, mismatched-SHA, heavily throttled, or partially successful staging runs now fail instead of appearing release-ready.
- Rollback: Revert this PR.
- Provider or production effects: None. No database migration, deployment, provider call, live soak, tenancy fixture write, or production configuration change was performed.
- RAG impact: no retrieval behaviour change — test-only assertion pins the existing reserve-aware fast-route generation deadline; retrieval, ranking, selection, comparator, and answer behavior are unchanged.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- The report's missing-live `migration_history_versions()` finding was already resolved on current main; issue #1963 is closed. This PR makes the workflow diagnostic and remediation text accurate rather than adding another migration.
- The first hosted Static PR run identified only the expected generated pending-request snapshot drift. That snapshot was refreshed and its focused checker passes at the new head.
- After this PR lands, reconcile the three immutable outstanding-issues inbox requests through the repository's serialized ledger workflow.
- Live staging tenancy, authenticated soak, rollback, browser matrix, clinical approval, privacy/legal approval, and organisational ownership remain operator/governance evidence rather than code-only quick wins.
- PR policy was blocked because the last Clinical Governance item was paraphrased; this template restores the exact required wording.

## Summary

- File dated point-in-time reviews under their canonical `docs/audit/` and `docs/archive/` locations and repair every affected repository reference.
- Archive completed ledger work through the guarded writers, preserve the append-only review history, and correct `#101` so it no longer proposes the metadata and memory hydration already shipped by PR #1474.
- Keep the existing performance-only PostgreSQL plan hint while updating migration references and the generated drift manifest.

## Verification

- [x] `npm run drift:manifest` — passed; scratch PostgreSQL replay completed and regenerated `supabase/drift-manifest.json` for the changed schema source.
- [ ] `npm run verify:pr-local` — partial: runtime, installed-lock parity, changed-file formatting, sitemap/docs checks, ledger guards, workflow/policy guards, lint, and typecheck passed. The full unit stage failed in unrelated Windows/baseline areas (`bundle-budget`, `pr-handoff-stop`, worker-observability timing, and document-viewer virtualization timing), so build and offline RAG evaluation were not reached.
- [x] `npm run check:outstanding-issues`, `npm run check:branch-review-ledger`, `npm run docs:check-links`, `npm run docs:check-inventory`, `npm run docs:check-index`, `npm run check:migration-role`, and `npm run format` — passed.
- [x] `npm run test -- tests/drift-detection.test.ts` — 12/12 passed.

UI verification not run: this PR does not change UI, routing, styling, browser behavior, reduced motion, or forced-colors behavior.

RAG impact: no retrieval, ranking, candidate-selection, source-rendering, or answer-contract behavior changes. The ledger text only records that PR #1474 already shipped metadata and memory hydration parallelisation; the remaining candidates stay behind their existing RAG flag and canary requirements.

## Risk and rollout

- Risk: Low. Most changes are documentation/reference moves. The only executable database delta is the existing `force_custom_plan` performance hint; it does not change result sets, RLS, schema shape, or clinical logic.
- Rollback: Revert this PR. No data migration or destructive operation is required.
- Provider or production effects: None. Drift-manifest generation used a worktree-owned local scratch PostgreSQL container only.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked; no clinical decision-support behavior changes

## Notes

- Historical capacity and scale reviews are rename-only snapshots. Their point-in-time wording is intentionally preserved under `docs/audit/`; current repository policy says historical audit records are superseded rather than rewritten.

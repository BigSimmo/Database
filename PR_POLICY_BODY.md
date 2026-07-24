## Summary

Two search-correctness fixes in separate commits (no ranking/retrieval behaviour change):

1. **#030** — Remove dual-listed Admission-to-Discharge titles from the wide-tier `AdmissionCommunityPts` alias list so one retrieved document cannot make `allHit` true for both admission and discharge comparison slots. Fail-closed contracts plus distinct-source matching in `tests/eval-document-matching.test.ts`.
2. **#075** — Add bounded deterministic pagination for `document_labels` in `resolveSearchScope` (`loadScopeLabels`) so matches past the Supabase 1,000-row response cap are not silently dropped. Multi-page >1000 contracts and fail-closed page-budget guard in `tests/search-scope.test.ts`. Isolated from mixed PR #1132.
3. **Cleanup** — Remove stale `PR_POLICY_BODY.md` leftover that was overwriting unrelated PR descriptions via Sync PR policy body.

**RAG impact: no retrieval behaviour change — eval matching / label pagination only.**

## Verification

- [x] Focused Vitest: `tests/eval-document-matching.test.ts`, `tests/eval-search.test.ts`, `tests/eval-utils.test.ts`, `tests/search-scope.test.ts` (32/32)
- [x] `npm run verify:cheap`
- [x] `npm run verify:pr-local` — runtime, format, lint, typecheck, full unit suite (3326), production build, client-bundle secret scan, offline RAG fixtures 36/36
- UI verification not run: no UI/routing/styling changes
- Live retrieval/ranking evals not run: no protected ranking surfaces touched
- `npm run check:production-readiness` — expected FAIL in secretless demo VM (missing Supabase/OpenAI env); Node 24 boot guards passed

## Risk and rollout

- Risk: Low — eval matching tables and scope label loading only; released search order and ranking scores unchanged
- Rollback: revert the fix commits on this branch
- Provider or production effects: None

## Clinical Governance Preflight

<!-- GOVERNANCE_PREFLIGHT -->

## Notes

- Ledger: `#030` and `#075` archived in `docs/outstanding-issues.md`; recommended-queue order 4 removed (gap intentional).
- Stop rules honored: no alias-tier bulk merges into strict golden aliases, no comparator/clamp/rerank changes, no live canaries.
- Branch synced with `origin/main`. This file is a temporary CI body-sync template and must be deleted before merge so it does not pollute later PRs.

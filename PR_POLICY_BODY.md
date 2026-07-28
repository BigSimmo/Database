## Summary
- Prevents numeric verification from silently skipping clinical numeric claims after the 24-claim assessment cap.
- Keeps existing detailed support assessment cap while failing closed for numeric overflow claims.
- Adds regression coverage for overflow numeric claim behavior.

RAG impact: no retrieval behaviour change — this changes post-verification failure handling and adds guardrail coverage only.

## Verification
- [x] `npx vitest run tests/rag-claim-support.test.ts` (40/40)
- Verification not run: full `npm run verify:pr-local` not required for this metadata/body remediation pass; UI verification not run: no UI/routing/styling changes.

## Risk and rollout
- Risk: medium; changes clinical answer fail-closed behavior when numeric claims exceed the assessment cap, making overflow figures fail closed instead of being silently skipped.
- Rollback: revert the commit that introduces unassessedClaimTexts fail-closed handling in assessAndEnforceClaimSupport / applyNumericVerification.
- Provider or production effects: None

## Clinical Governance Preflight
- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Summary

- Restructures documents search results chrome so the identity header ("N documents / Results for ...") leads, Sort and type filters share one compact toolbar with a chip-sized Library action, removes "Also in your library" from documents search, and places scope/governance notices below that chrome.
- Services/forms keep the governance notice above the panel; document home still offers Browse library as a start action.

## Verification

- [x] `npm run verify:pr-local` — runtime, format, lint, typecheck, build, and RAG fixtures passed on PR head. Full unit suite locally: 2948 passed / 2 failed in `tests/pdf-extraction-budget.test.ts` (Python/PDF env artifact; identical on clean main; hosted Unit coverage green).
- [x] Focused Playwright: documents search `@critical`, deferred source/admin `@critical`, and forms result-sort URL persistence — all passed.
- [x] `npm run check:design-system-contract`, `check:icon-scale --strict`, `check:maintainability-budgets` — passed.
- UI verification not run: full `verify:ui` suite deferred; focused Chromium smoke for the redesigned documents controls passed locally and hosted Production UI remains the broader UI gate.

## Risk and rollout

- Risk: low–medium UI/UX — documents results chrome, sort/filter toolbar, and governance-notice placement only. No retrieval scoring, migrations, auth, or answer-generation changes.
- Rollback: revert the PR commit; UI returns to the prior overview card + cross-mode strip layout.
- Provider or production effects: None.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Final review fixed Prettier CI failure, unified toolbar a11y/density, and a memo-busting empty-array default for governance warnings.
- Updates stale leftover `PR_POLICY_BODY.md` from #932 so CI syncs an accurate ready-for-review body for this PR.

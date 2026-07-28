## Summary

- Synced `codex/fix-p2-audit-20260719` with current `main` (~790 commits / 33 content conflicts) without regressing main's already-landed remediations (secret scanner masking, Babel parser 8, RAG module layout, embedding coalesce abort, join-constructed offline DB URL).
- Restored the GitGuardian-safe offline Postgres URL construction (the tip had reintroduced a literal URI that tripped secret scanning).
- Retained unique P2 improvements: clinical-search neuroleptic/clozapine monitoring + brand-alias ranking, sheet focus-trap hardening, Playwright `serviceWorkers: "block"` with PWA opt-in, and supporting regression tests.

RAG impact: behaviour change — canary pair offline Vitest clinical-search/retrieval-variants (219) -> weekly eval-canary post-merge.

## Verification

- [x] Focused Vitest on unique delta: 219/219 passed (`clinical-search`, `eval-retrieval`, `rag-route-budget`, `retrieval-query-variants`, secret/offline/architecture suites)
- [x] `npm run check:branch-review-ledger` passed
- [x] `git merge-tree` vs `origin/main` clean (0 conflict markers)
- [ ] `npm run verify:pr-local`
- UI verification not run: Playwright UI matrix not required for this babysit pass; Chromium suite remains CI-gated. Unique UI delta is sheet focus-trap + Playwright SW config only.
- Verification not run: `npm run verify:release` / live `eval:retrieval:quality` — provider-backed; not authorized in this pass.

## Risk and rollout

- Risk: medium — clinical-search ranking and retrieval query-variant behaviour changed for clozapine/neuroleptic paths; brand-alias matching widens which evidence counts as on-subject.
- Rollback: revert this branch's unique commits on top of main (or revert the merge commit); offline DB URL and secret-scanner paths already match main.
- Provider or production effects: None in this pass (no OpenAI/Supabase/live eval writes).

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- GitGuardian finding on `tests/offline-release-profile.test.ts` was a false-positive literal URI regression vs main's `.join(":")` construction; tip now matches main.
- Bugbot/CodeRabbit triage: fixed brand-alias ranking, neuroleptic dose-class ordering, duplicate `serviceWorkers`, sheet inert/aria-hidden filter, WCC blood-intent, and formulation `toPass` click-once.

## Summary

- Audit remediation: IPv6/port client-IP normalization, defensive semantic-rerank score clamping, PWA BroadcastChannel update signaling, heavyweight test-run lock live-owner preservation, PDF extractor signal handling, and fixed skill-catalog count pins.

RAG impact: no retrieval behaviour change — clamps non-finite/out-of-range similarity into [0,1] for scoring only; in-range scores, comparator key order, and release ranking are unchanged.

## Verification

- [x] Focused: `node scripts/run-vitest.mjs run tests/test-runner-safety.test.ts` (17/17)
- [x] Focused: `node scripts/run-vitest.mjs run tests/database-skills.test.ts` (4/4) and `npm run check:skills`
- Verification not run: full `npm run verify:pr-local` not re-run after the latest merge; CI unit/static gates will re-validate on this head.
- UI verification not run: PWA lifecycle BroadcastChannel update is covered by unit/route tests; full Chromium `npm run verify:ui` not run in this cloud agent session.

## Risk and rollout

- Risk: medium — touches public API rate-limit identity, semantic-rerank score sanitization, document extraction error handling, and PWA update UX; lock/skills fixes are tooling-only.
- Rollback: after squash-merge, revert the single squash commit on main; no schema/migration dependency.
- Provider or production effects: None

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Review P1 live-lock reclaim and P2 skill-catalog tautology were fixed and resolved on-thread.
- `PR_POLICY_BODY.md` exists so CI Sync PR policy body can write this description (agent token cannot edit the live PR body directly). Safe to delete after policy is green if you do not want the sync template retained.

## Summary

Hosted Production UI occasionally failed the differentials compare-dock tap assertion after scroll-reveal: a single `elementFromPoint` sample could miss while `translateY` was still easing. Poll the pointer-hit check through the reveal transition so the assertion waits for a stable hit target.

The original phone Answer header gutter asymmetry is already fixed on `main` by #940 (`--header-edge-pad`); this PR does not change header spacing.

## Verification

- [x] `npm run verify:pr-local`
- [x] `npm run verify:ui` when UI, routing, styling, browser behavior, reduced-motion, or forced-colors behavior changed
- [ ] `npm run verify:release` before release or handoff confidence claims

UI verification: Chromium compare-dock test and prior full `verify:ui` on this branch lineage; hosted Production UI also passed after the poll harden on earlier heads.

- [ ] **`npm run eval:retrieval:quality` (must stay 36/36) when retrieval, ranking, selection, chunking, or scoring behavior changed** — not applicable
- [ ] `npm run eval:rag -- --limit 15` + `npm run eval:quality -- --rag-only` when answer generation, the synthesis prompt, or answer post-processing changed — not applicable
- [ ] `npm run check:production-readiness` when clinical workflow, privacy, environment, Supabase, source governance, or deployment behavior changed — not applicable
- [ ] `npm run check:deployment-readiness` when deployment startup, hosting, or rollout behavior changed — not applicable

## Risk and rollout

- Risk: Low. Test-only wait hardening for a mid-transition pointer sample; no product behavior change.
- Rollback: Revert the compare-dock `expect.poll` change in `tests/ui-tools.spec.ts`.
- Provider or production effects: None

## Notes

- Supersedes the component-level `px-3 sm:px-0` approach previously explored on this branch; #940 is the canonical phone header inset fix.
- Also replaces the leftover Mode-menu `PR_POLICY_BODY.md` from #935 on this head so Sync applies this PR's description.

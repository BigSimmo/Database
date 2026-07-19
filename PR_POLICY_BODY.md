## Summary

- Fixes differentials mobile search results being vertically clipped: tall results reused `ModeHomeMain`’s `justify-center` flex shell (from the edge-to-edge mobile layout), so Best Answer and the top of the list sat above the phone scrollport.
- Introduces an exclusive `contentAlign` API (`center` | `start` | `startOnPhone`) on `ModeHomeMain`, strips stray `justify-*` className tokens (including responsive prefixes), and top-aligns differentials results while keeping empty homes centred.
- Migrates content-rich mode homes (therapy, formulation, specifiers, DSM, forms, services) to `startOnPhone` so they cannot reintroduce the same clip via fragile `className` overrides.
- Hardens compact Best Answer / chip typography so size overrides do not rely on `cn()` Tailwind conflict resolution, and stabilizes the home header wait in overlap Playwright coverage.

## Verification

- [x] `npx vitest run tests/mode-home-main-align.test.ts` — ModeHomeMain alignment contract.
- [x] Focused Chromium proof in `tests/ui-tools.spec.ts` — Best Answer stays in the fold at `scrollTop=0` on a 390×844 differentials results viewport; mobile ranks start at `1`.
- [x] `tests/ui-overlap.spec.ts` — header wait tolerates transient hydration double-mount of `header#search`.
- [ ] Hosted Production UI / PR required — re-run on this head after push.

## Risk and rollout

- Risk: low — layout/alignment and test-only changes; no retrieval, answer generation, auth, RLS, or migrations.
- Rollback: revert the PR commit; mode homes return to always-centred `ModeHomeMain` behavior.
- Provider or production effects: none.

## Clinical Governance Preflight

<!-- GOVERNANCE_PREFLIGHT -->

## Notes

- Root cause: commit `39d14a51` made `ModeHomeMain` a `flex-1 justify-center` shell. `cn()` concatenates classes and does not merge Tailwind, so call-site `justify-start` overrides were non-deterministic.
- Prefer `contentAlign` over any `justify-*` in `className` on `ModeHomeMain`.

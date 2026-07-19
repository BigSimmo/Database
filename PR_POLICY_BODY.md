## Summary

- Fixes differentials mobile search results being vertically clipped: tall results reused `ModeHomeMain`’s `justify-center` flex shell (from the edge-to-edge mobile layout), so Best Answer and the top of the list sat above the phone scrollport.
- Introduces an exclusive `contentAlign` API (`center` | `start` | `startOnPhone`) on `ModeHomeMain`, strips stray `justify-*` className tokens (including responsive prefixes), and top-aligns differentials results while keeping empty homes centred.
- Migrates content-rich mode homes (therapy, formulation, specifiers, DSM) to `startOnPhone`, and top-aligns forms/services only when their registries are seeded so short empty/loading notices stay centred.
- Hardens compact Best Answer / chip typography so size overrides do not rely on `cn()` Tailwind conflict resolution, and stabilizes the home header wait in overlap Playwright coverage.

## Verification

- [x] `npx vitest run tests/mode-home-main-align.test.ts` — 5/5 ModeHomeMain alignment contract.
- [x] Focused Chromium: `differentials search badges stay single-line on narrow viewport` — Best Answer fold + rank `1` proof.
- [x] `tests/ui-overlap.spec.ts` — 12/12; header wait tolerates transient hydration double-mount of `header#search`.
- [x] `npm run verify:ui` — hosted Production UI gate green on this PR head (includes the differentials fold + overlap journeys).

## Risk and rollout

- Risk: low — layout/alignment and test-only changes; no retrieval, answer generation, auth, RLS, or migrations.
- Rollback: revert the PR commit; mode homes return to always-centred `ModeHomeMain` behavior.
- Provider or production effects: none.

## Clinical Governance Preflight

<!-- GOVERNANCE_PREFLIGHT -->

## Notes

- Root cause: commit `39d14a51` made `ModeHomeMain` a `flex-1 justify-center` shell. `cn()` concatenates classes and does not merge Tailwind, so call-site `justify-start` overrides were non-deterministic.
- Prefer `contentAlign` over any `justify-*` in `className` on `ModeHomeMain`.

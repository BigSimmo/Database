## Summary

- Fix phone header new-chat edge spacing by restoring a real `.edge-glass-header` inset after an unlayered `@media (max-width: 639px)` rule had zeroed padding and beaten `@layer components`.
- Share phone/sm inset via `--header-edge-pad: 1rem` (aligned with mode-home `px-4`) and keep the unlayered phone media guard on the same token so a `0px` override cannot return.
- Lock symmetry with Playwright geometry checks at 360/390 and a source contract that rejects a `max(0px, safe-area)` header override.

## Verification

- [x] `npm run verify:ui` — 242/242 Chromium PR suite on the functional head before the docs/ledger closeout
- [x] Focused Playwright `tests/ui-overlap.spec.ts` — 14/14 including new left/right inset symmetry asserts
- [x] Focused Vitest `tests/ui-overlay-css-contract.test.ts` — 5/5 including the header-edge-pad contract
- [x] Live geometry probe at 360/390/640 — header pad and control insets `16px` / `16px` (`delta: 0`)
- Verification not run: full local `verify:pr-local` unit stage blocked by the known container-only `pdf-extraction-budget` python ENOENT artifact (also fails on clean main; hosted Unit coverage remains the authority)

## Risk and rollout

- Risk: Low — shared header chrome padding only; no API, auth, retrieval, or clinical-output behavior changes.
- Rollback: Revert the PR squash commit; CSS tokens and tests are additive/self-contained.
- Provider or production effects: None

## Notes

- Touches `src/app/globals.css` and UI overlap/contract tests only for the functional fix; mode-pill width left unchanged because the 1rem phone inset still fits the existing `100vw-11.5rem` budget.
- Merged current `origin/main` including Safari dock reserve tokens (#933) and ingestion-worker lease hardening (#937).
- Replaced the stale admin/migration `PR_POLICY_BODY.md` leftover from #932 so CI sync applies this UI-only description.

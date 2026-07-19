## Summary

- Fix phone header new-chat edge spacing by restoring a real `.edge-glass-header` inset after an unlayered `@media (max-width: 639px)` rule had zeroed padding and beaten `@layer components`.
- Share phone/sm inset via `--header-edge-pad: 1rem` (aligned with mode-home `px-4`), keep the unlayered phone guard on the same token, and widen the Answer mode pill reserve to `calc(100vw-12rem)`.
- Lock symmetry with Playwright geometry checks at 360/390 and a source contract that rejects a `max(0px, safe-area)` header override.

## Verification

- [x] `npm run verify:ui` — 242/242 Chromium PR suite on the functional head before the docs/ledger closeout
- [x] Focused Playwright `tests/ui-overlap.spec.ts` — 14/14 including new left/right inset symmetry asserts
- [x] Focused Vitest `tests/ui-overlay-css-contract.test.ts` — 5/5 including the header-edge-pad contract
- [x] Live geometry probe at 360/390/640 — header pad and control insets `16px` / `16px` (`delta: 0`)
- Verification not run: full local `verify:pr-local` unit stage blocked by the known container-only `pdf-extraction-budget` python ENOENT artifact (also fails on clean main; hosted Unit coverage remains the authority)

## Risk and rollout

- Risk: Low — shared header chrome padding and a mode-pill width reserve only; no API, auth, retrieval, or clinical-output behavior changes.
- Rollback: Revert the PR squash commit; CSS tokens and tests are additive/self-contained.
- Provider or production effects: None

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`) <!-- pragma: allowlist secret -->
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Path `src/components/clinical-dashboard/...` is classified clinical-risk by PR policy filename rules even though this change is header chrome only; governance items are confirmed unchanged.
- Merged current `origin/main` including Safari dock reserve tokens (#933) and ingestion-worker lease hardening (#937).
- Stale admin/migration PR_POLICY_BODY.md from #932 was replaced so CI sync applies this UI-only description.

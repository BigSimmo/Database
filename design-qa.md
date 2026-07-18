# Design QA — 2026-07-15

## Scope and source of truth

- Implementation: Clinical KB at `http://localhost:4392` from `codex/design-polish-pass` (`0c56f27a37af88a073d2bb695d2cf4c05067ff4f` before edits).
- Source visual truth: **unavailable**. No Figma file, approved screenshots, mockup package, or other independent target was supplied. The existing product design system was treated as the consistency baseline, not as proof of target fidelity.
- Runtime safety: local Next.js server only. OpenAI variables were cleared, Supabase variables pointed at a non-listening local placeholder, and provider mode was set to offline. No provider-backed workflow was run.

## Viewport and route evidence

- Desktop sweep at 1440 × 1000: 30 routes covering Answer, Documents, Services, Forms, Favourites, Differentials, DSM, Specifiers redirects, Formulation, Prescribing/Medication, Tools/Application redirects, Privacy, and colour coding.
- Phone sweep at 390 × 844: 21 representative routes across the same production surfaces.
- Focused responsive proof after remediation: 320 × 700, 390 × 844, 639 × 900, 768 × 1024, 1440 × 1000, and 1920 × 1080.
- Desktop route metrics: `artifacts/design-audit-2026-07-15/desktop-route-metrics.json`.
- Phone route metrics: `artifacts/design-audit-2026-07-15/mobile-route-metrics.json`.
- Representative screenshots: `01-home-desktop.png`, `32-answer-home-mobile.png`, `46-formulation-builder-mobile.png`, `53-formulation-builder-mobile-after.png`, `54-formulation-builder-320-after.png`, `55-formulation-builder-768-after.png`, and `56-formulation-builder-1920-after.png` in `artifacts/design-audit-2026-07-15/`.

## Comparison history

### Iteration 0 — full live audit

- Long phone pages in the shared standalone shell exposed two independent vertical scroll surfaces: the document root and `#main-content`.
- On `/formulation/builder` at 390 × 844, the document scroll height reached 2813 px while the app scrollport also contained the long page.
- No true root horizontal overflow was found. Wide children reported in the phone metrics were contained horizontal scrollers rather than page overflow.
- No reproducible clipping, overlap, inaccessible touch target, or console warning was found in the accepted route screenshots.

### Iteration 1 — scroll ownership remediation

- Anchored the phone standalone shell to the dynamic viewport and retained `#main-content` as its only vertical scroll owner.
- After the change, `/formulation/builder` at 390 × 844 reported document `clientHeight=844` and `scrollHeight=844`; `#main-content` reported `clientHeight=772` and `scrollHeight=3778`.
- The same invariant held at 320 × 700 and 639 × 900. At 768 px and wider, the shell returns to normal document scrolling so sticky desktop descendants keep working.
- Added a Playwright regression test for the single-scrollport contract.

### Iteration 2 — interaction and design-system polish

- Closing the app-mode menu on Tab prevents an abandoned floating menu after keyboard focus leaves it.
- Decorative dynamic icons now declare `aria-hidden` explicitly.
- Press-scale feedback is restricted to motion-safe environments.
- Sheet overlays now use `--overlay-backdrop`; forced-colors remaps glass, gloss, and backdrop tokens to solid system colours.

## Verification evidence

- Browser inspection: accepted screenshots at the viewports above; no root horizontal overflow; no warning/error console entries on inspected representative pages.
- Focused scroll regression: 1/1 passed.
- Keyboard mode-menu regression: 1/1 passed.
- Accessibility media suite: 5/5 passed (reduced motion, forced colours, 200% zoom, default axe WCAG A/AA, forced-colours axe WCAG A/AA).
- `npm run verify:cheap`: passed; 259 test files passed, 1 skipped; 2417 tests passed, 1 skipped; lint and TypeScript clean.
- `npm run verify:ui`: passed; 175/175 Chromium and Chromium-mockups tests.
- Focused Prettier, ESLint, TypeScript, type-scale, and icon-scale checks passed.

## Findings disposition

- P0/P1: none reproduced.
- P2 double phone scroll surface: fixed and regression-tested.
- P2 keyboard mode menu remains open after Tab: fixed and regression-tested.
- P3 motion/forced-colours/design-token consistency: fixed and accessibility-tested.
- Residual product risk: content and clinical governance were outside this design-only change; provider-backed behavior was deliberately not exercised.

## Final result

Final result: **blocked**.

Blocker: an independent source visual target is required to certify concept fidelity. Implementation-level responsive, interaction, accessibility, and regression QA passed, but the design cannot honestly be declared pixel-faithful to an external approved concept that was not supplied.

## Follow-up audit — 2026-07-17

The exhaustive line-level design, accessibility, UX, interaction, and route-coverage follow-up is documented in [`docs/design-audit-2026-07-17.md`](docs/design-audit-2026-07-17.md). It preserves the fixes above, avoids duplicating this pass, and records the new P1/P2/P3 fixes plus the exact local verification limitations.

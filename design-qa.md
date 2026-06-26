**Source Visual Truth**
- Main answer state target: `C:\Users\joshs\AppData\Local\Temp\codex-clipboard-1cece938-9dd9-40cf-8fa1-eaade3c0d378.png`
- Evidence/source behaviour target: `C:\Users\joshs\AppData\Local\Temp\codex-clipboard-7728dc87-8e3a-459a-97de-5ae9d103d5c7.png`
- Navigation/documents/daily tools target: `C:\Users\joshs\AppData\Local\Temp\codex-clipboard-9a48092e-9b52-44b1-ad68-7123224c4eed.png`
- Mobile responsive target: `C:\Users\joshs\AppData\Local\Temp\codex-clipboard-5e4ffba7-1089-472b-a294-9f383fe7ca36.png`
- Phase scope: Phase 7 visual parity polish after Phase 6 hardening. Keep behavior stable while tightening canvas color, answer density, table width, document-search controls, and low-elevation surfaces against the supplied mockups.

**Implementation Evidence**
- Mobile empty screenshot: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-7\mobile-empty.png`
- Mobile menu screenshot: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-7\mobile-menu-open.png`
- Mobile daily actions screenshot: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-7\mobile-daily-actions.png`
- Mobile answer screenshot: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-7\mobile-answer-default.png`
- Mobile documents screenshot: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-7\mobile-documents.png`
- Desktop answer screenshot: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-7\desktop-answer-default.png`
- Viewports: mobile 390x820, desktop 1280x900, light theme, controlled demo fixtures.

**Findings**
- No P0/P1 findings remain for Phase 7.
- Remaining visual parity gap is P2 polish only: the rendered answer state is still a little lower-contrast and more spacious than the mockup, but the shell, mode behavior, evidence layout, documents mode, and mobile menu interactions match the planned structure.
- Mobile hamburger now opens an opaque left-side Clinical Guide sheet without clipped or half-animated capture states.
- Mobile `+` now opens a real Daily actions bottom sheet with focus trapping, Escape close, and visible 44px+ action tiles.
- The fixed composer no longer covers answer action rows, source-preview actions, document-card actions, or evidence controls in the checked states.
- The inline answer table is no longer forced to a wide mobile min-width; the explicit expand affordance sits below the compact table preview instead of covering cells.
- Mobile evidence tabs now keep stable mounted tab panels for valid `aria-controls` references, and tab controls meet the 44px mobile target.
- Documents mode is cleaner: default result cards no longer show the diagnostic tag facet rail or "No direct support" chips unless useful support metadata is present.

**Patches Made In Phase 7**
- Shifted the main Clinical Guide shell back to a white clinical canvas instead of the heavier blue-grey page tint.
- Narrowed the answer content column on active chat states to better match the mockup reading width.
- Slightly tightened mobile key-monitoring typography and list line-height while preserving 44px interactive controls.
- Reduced inline table preview width and elevation so it reads as supporting evidence rather than the dominant card.
- Lightened document-search panel/card shadows and made the mobile document-search submit control icon-only to reduce button heaviness.
- Kept source capsule, clinical notes, evidence rows, mobile sidebar, daily actions, and documents mode behavior unchanged.

**Patches Retained From Phase 6**
- Removed left-sheet translation/fade issues from the shared `Sheet` placement and hid the bottom-sheet handle for left navigation sheets.
- Moved mobile Daily actions out of the fixed composer form so it gets a proper viewport stacking context.
- Upgraded shared answer/source/table action primitives to 44px touch targets on mobile while keeping compact desktop sizing.
- Converted the mobile dashboard wrapper to a real flex column so the scroll region can reserve space above the fixed composer.
- Added bounded scrolling to the source capsule preview.
- Changed dense table previews to `min-w-full` and moved the expand button to a full-width mobile row.
- Mounted hidden mobile evidence tab panels to repair inactive-tab ARIA references.
- Hid diagnostic document support chips when relevance is absent or unsupported.
- Added smoke coverage for on-screen mobile sidebar placement, Daily actions sheet behavior, 44px targets, document diagnostic suppression, and evidence tab panels.

**Verification**
- `npm run ensure` confirmed the app at `http://localhost:4298`.
- `npx playwright test tests/ui-smoke.spec.ts --project=chromium --grep "dashboard loads without page overflow at small-mobile|demo answer flow reaches|document search mode lists" --reporter=line` passed.
- `npx playwright test tests/ui-stress.spec.ts --project=chromium --grep "many documents and citations do not overflow at mobile|many documents and citations do not overflow at desktop" --reporter=line` passed.
- `npm run verify:cheap` passed: lint, typecheck, and 441 Vitest tests.
- `npm run verify:ui` passed: 28 Chromium Playwright tests.

**Follow-up Polish**
- Consider adding a stable visual-regression snapshot once the current Clinical Guide parity pass is signed off.

final result: passed

---

**Phase 8 Visual QA Polish**

**Scope**
- Compared the live Clinical Guide states against the supplied mockups for mobile empty, mobile answer, mobile documents, and desktop answer.
- Focused this pass on density, answer contrast, table preview dominance, document-search parity, and regression checks for sidebar/daily-actions/source/evidence behavior.

**Current Screenshots**
- Mobile empty: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-8\mobile-empty-current.png`
- Mobile answer: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-8\mobile-answer-current.png`
- Mobile documents home: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-8\mobile-documents-home-current.png`
- Mobile documents results: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-8\mobile-documents-results-current.png`
- Desktop answer: `C:\Dev\Apps\Database\output\playwright\clinical-guide-phase-8\desktop-answer-current.png`

**Changes Made**
- Tightened natural answer spacing, answer icon size, source capsule placement, and mobile source preview positioning.
- Increased answer body and action-row contrast to primary heading ink.
- Reduced table preview width, elevation, header height, and inner padding so it reads as supporting evidence.
- Prevented mobile horizontal drift from source previews and dense table cells.
- Restored the documents-mode top search input and filter row inside the document workspace.
- Removed live "Mockup" labels from document mode and kept the surface product-facing.
- Added an explicit `turbopack.root` in `next.config.ts` after local Next docs review to stabilize `npm run ensure` under this workspace layout.

**Regression Coverage**
- Mobile hamburger opens the full Clinical Guide side menu through existing smoke coverage.
- Mobile `+` opens the Daily actions sheet, not guide/help.
- Documents mode shows search input, filters, sort, result count, and result cards.
- Source capsule preview, clinical notes, evidence rows, table expansion, and no-overflow paths are covered by focused smoke/stress checks and the full Chromium UI gate.

**Verification**
- `npm run ensure` confirmed the app at `http://localhost:4298`.
- `npx playwright test tests/ui-smoke.spec.ts --project=chromium --grep "document search mode lists matching documents and scope actions" --reporter=line` passed.
- `npx playwright test tests/ui-smoke.spec.ts --project=chromium --grep "dashboard loads without page overflow at small-mobile|demo answer flow reaches|document search mode lists|clinical table mobile expansion" --reporter=line` passed: 6 tests.
- `npx playwright test tests/ui-stress.spec.ts --project=chromium --grep "many documents and citations do not overflow at mobile|many documents and citations do not overflow at desktop" --reporter=line` passed: 2 tests.
- `npm run verify:cheap` passed: lint, typecheck, and 444 Vitest tests.
- `npm run verify:ui` passed: 28 Chromium Playwright tests.

final result: passed

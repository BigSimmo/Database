# Verification Report

Scope: ultra-premium mobile-first redesign — token system, component layer, dashboard + document-viewer mobile surfaces, plus reconciliation of merge-integration regressions that landed in `main` from parallel branches. Checks were run in `C:\Dev\Apps\Database` on the reconciliation branch after isolating the final `main` fixes.

## June 20 scoped run — dashboard/viewer only, Tools deferred

Last reviewed: 2026-07-04. Historical verification log for the premium-redesign reconciliation pass; branch names and test counts are snapshots only.

| Check            | Command                                                                                                                               | Result                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused lint     | `npx eslint src\components\ClinicalDashboard.tsx src\components\DocumentViewer.tsx src\lib\clinical-safety.ts tests\ui-smoke.spec.ts` | Pass                                                                                                                                       |
| Repo lint        | `npm run lint`                                                                                                                        | Pass exit code; 10 warnings remain in pre-existing `.tmp-visual`, `src/lib/rag.ts`, and `tests/deep-memory.test.ts` files                  |
| Typecheck        | `npm run typecheck`                                                                                                                   | Pass                                                                                                                                       |
| Unit tests       | `npm run test`                                                                                                                        | Pass, 58 files / 412 tests                                                                                                                 |
| Production build | `npm run build`                                                                                                                       | Pass                                                                                                                                       |
| Scoped format    | `npx prettier --check` on touched files                                                                                               | Pass                                                                                                                                       |
| Repo format      | `npm run format:check`                                                                                                                | Fail: 53 unrelated pre-existing files remain unformatted, mostly staged `.tmp-visual`, `scratch`, scripts, and existing library/test files |
| Chromium smoke   | `npx playwright test tests/ui-smoke.spec.ts --project=chromium --reporter=line`                                                       | Pass, 22/22                                                                                                                                |
| Chromium stress  | `npx playwright test tests/ui-stress.spec.ts --project=chromium --reporter=line`                                                      | Pass, 2/2                                                                                                                                  |

Browser QA:

- Browser/IAB was attempted first per frontend validation policy. It opened the mobile upload sheet, but `Page.captureScreenshot` timed out; screenshots fell back to repo Playwright and this fallback is recorded here.
- Playwright screenshots captured outside the repo:
  - `C:\Users\joshs\AppData\Local\Temp\clinical-kb-premium-redesign\desktop-dashboard.png`
  - `C:\Users\joshs\AppData\Local\Temp\clinical-kb-premium-redesign\mobile-upload-sheet.png`
  - `C:\Users\joshs\AppData\Local\Temp\clinical-kb-premium-redesign\mobile-document-actions.png`
- Screenshot states verified: desktop dashboard at 1280×900, mobile upload sheet at 390×820, mobile real document actions sheet at 390×820. No horizontal overflow in all three captures.
- Console health: final screenshot pass had no console warnings/errors. An earlier desktop capture produced a React hydration mismatch caused by Playwright screenshotting before hydration finished; recapturing after a longer hydration settle cleared it.

Functional/regression notes:

- Upload/indexing sheet: mobile trigger opens the sheet; `Setup`, `Upload`, and `Jobs` tabs are reachable; setup checklist and upload labels remain visible; duplicate-upload smoke still completes.
- Document viewer: mobile header keeps summarise visible and moves admin actions behind `Open document actions`; action sheet opens on a real `/documents/{id}` route.
- Active PDF/chunk evidence states are verified through mocked Chromium smoke. The live first 150 local documents did not include an indexed document with pages/chunks, so live viewer screenshot used a queued PDF record for shell/action verification.
- `/tools`, `src/app/tools/page.tsx`, and `src/lib/tools.ts` were not edited by this scoped run. Existing staged `/tools` changes remain in the dirty worktree and are deferred.

Unverified or limited:

- Full Firefox/WebKit smoke not run.
- Reduced-motion and forced-colors were verified by code/token review and existing smoke coverage, not by a dedicated browser emulation pass in this run.
- Repo-wide format is not green because of unrelated dirty/staged files; touched scoped files are Prettier-clean.

## 1. Technical checks (main checkout) — all green

| Check            | Command                                                         | Result               |
| ---------------- | --------------------------------------------------------------- | -------------------- |
| Types            | `npm run typecheck`                                             | ✅ pass              |
| Unit tests       | `npm run test` (vitest)                                         | ✅ **341/341 pass**  |
| Format           | `npm run format:check` (prettier)                               | ✅ pass              |
| Lint             | `npm run lint` (eslint 9.39.4)                                  | ✅ pass, no warnings |
| Smoke (chromium) | `npx playwright test tests/ui-smoke.spec.ts --project=chromium` | ✅ **22/22 pass**    |

Clean-install caveat resolved in the reconciliation branch: `eslint` was pinned back to the latest compatible 9.x range because `eslint-config-next@16.2.9` pulls `eslint-plugin-react@7.37.5`, whose peer range supports ESLint 9 but not ESLint 10. The current runtime target is Node 24.x.

## 2. Smoke detail

The first full run on `main` had 7 failures — all traced to **parallel branches merged into `main`**, not the redesign (git topology: `2fc9cf0` is not an ancestor of my base `846943d`):

- 6× header height 251 > 180 budget — a taller command-style header from `2fc9cf0` ("Refactor database app routing and UI flows") that did not update the `≤180/185` test (`8c0996d`, in my base).
- 1× `:778` strict-locator collision — a merged `mobile-section-fab-menu` duplicating the "Search documents" label.

Per the user's decision ("reconcile to green, compact header"), these were fixed (decision log D6): the mobile search form was made single-row again and header rhythm tightened (back under 180/185), the duplicate hidden query-mode/filters block + orphaned `batches` prop were removed, and the `:778` locator was scoped to `main`. After the fixes the full suite is **22/22**, including the three tests that had looked "pre-existing" at the very first baseline (they were cold-compile timeouts, confirmed by warm reruns).

## 3. Responsive & device pass (Preview MCP, during build)

- Mobile (375) light + dark: header, cards, answer empty-state, bottom nav — clean; tokens resolve per theme.
- Scope bottom sheet (375): rises with scrim + drag grip, rows fully legible in light mode (the previous dark-only colours are fixed), tabular counts, teal focus ring. Anchored popover retained from `sm:` up.
- Tablet / laptop / large-desktop covered by the header-height + overflow smoke tests at 768/1280 (pass).

## 4. Design & accessibility pass

- Spacing/radius/type/colour come from tokens; new components use the `@theme` bridge utilities.
- New interactive components (`Sheet`, `Button`, `IconButton`, `Skeleton`) ship default/hover/focus-visible/pressed/disabled/loading states; global focus-visible ring preserved.
- `Sheet` traps focus, returns it to the opener, closes on Escape/backdrop — exercised by the guide + rename/delete flows; guide smoke tests pass through the new component.
- Reduced motion: removed the `transform: none !important` blanket that broke optical centring; animations/transitions/scroll-behaviour still zeroed; all entrance animations are `motion-safe:`-gated.
- Contrast: light primary `#0c8278` (≥4.5:1 with white button text and as text on white); semantic triads tuned ≥4.5:1 text-on-bg; muted/soft text ≥4.5:1 on surface. Forced-colors and print blocks retained.

## 5. Regression vs Phase 1 map

Every capability from the audit map is present and reachable: search (answer/documents), streaming answer + citations + evidence drawers, quotes/images/sources, document scope (mobile sheet), upload & indexing, setup checklist, guide (sheet), document viewer (pages, in-doc search, related docs, rename/delete sheets), plus the parallel-branch additions kept intact (query-mode, clinical filters, mobile section FAB menu). No routes, APIs, or data shapes changed; no dependencies added.

## 6. Unverified / declared

- Full 3-browser smoke (firefox + webkit) not run this session — chromium only. Recommend before release.
- `prefers-reduced-motion` and forced-colors verified by code/token review, not an automated emulation pass.
- `npm audit --audit-level=high` still reports one high-severity `esbuild` advisory. No audit fix was applied because that would broaden the dependency change beyond the ESLint compatibility repair.
- ClinicalDashboard decomposition deferred (`04-deferred.md`, decision log D5).

## 7. Post-cleanup dependency follow-up (esbuild)

- Scope: address the remaining `npm audit --audit-level=high` finding without changing framework/runtime behavior.
- Change: added root `package.json` override for `esbuild@0.28.1` (latest stable) and regenerated `package-lock.json`.
- Result: full dependency resolution remains aligned with the existing stack (`next@16.2.7`, `tsx@4.22.4`, etc.); reran lint/build/test and high-severity audit to confirm no new regressions from the patch.

# Deferred Items

## 0. Tools page redesign (resolved June 23, 2026)

`/tools`, `src/app/tools/page.tsx`, and `src/lib/tools.ts` are no longer deferred. The launcher now has dedicated mobile and desktop Playwright coverage through `tests/ui-tools.spec.ts`, included in `npm run verify:ui`.

## 1. ESLint 10 / eslint-plugin-react incompatibility (resolved July 1, 2026)

Resolved: `package-lock.json` now pins **eslint 9.39.4**, so a clean install no longer pulls eslint 10, and `npm run lint` passes cleanly on a fresh worktree install (verified July 1, 2026). Original entry kept below for history.

There was a lockfile/install mismatch around ESLint that predated and was independent of the redesign:

- **On the working `main` checkout**, `node_modules` had **eslint 9.39.4** and `npm run lint` passed cleanly. ✅
- **`package-lock.json` pinned eslint 10.4.1.** A clean `npm ci` therefore installed eslint 10, which broke `eslint-plugin-react@7.37.5` (`TypeError: contextOrFilename.getFilename is not a function` in `resolveBasedir`, thrown while linting `eslint.config.mjs` itself, before any source file). This was observed in the isolated worktree install. CI (`npm ci`) was therefore at risk even though the local checkout linted fine.

- **Why deferred:** Resolving the mismatch means changing dependency versions (bump `eslint-plugin-react`/`eslint-config-next` to an ESLint-10-compatible release, or pin eslint to 9.x) — Tier 3, requires approval. The repo has a `dependency` maintenance shortcut for exactly this.
- **Mitigation used:** redesign code was additionally linted via the eslint 9.39.4 engine against the same flat config — all changed TS/TSX files are lint-clean.
- **Recommended fix:** run the `dependency` shortcut, or bump `eslint-plugin-react` to a release compatible with ESLint 10, then reconcile the lockfile.

## 2. ClinicalDashboard decomposition (Tier 2, see decision log D5)

The 4,655-line `src/components/ClinicalDashboard.tsx` was not split into `clinical-dashboard/` modules this pass. It remains fully functional; this is maintainability-only.

- **Restart point:** the Plan-verified move map (lowest-coupling first) is in the approved plan — `use-theme.ts`, `badges.tsx`, `display-text.ts`, `guide-dialog.tsx`, `utility-drawer.tsx`, `setup-checklist.tsx`, `upload-drawer.tsx`, `master-search-header.tsx`, `answer-content.tsx`, `evidence-panels.tsx`, `output-panel.tsx`, `visual-evidence.tsx`, `document-results.tsx`, `auth-panel.tsx`.
- **Constraint reminder:** moving `ClinicalOutputPanel` requires updating `dashboardPath` in `tests/clinical-dashboard-merge-artifacts.test.ts` (it AST-pins the panel's location); all `data-testid`/`aria-label` strings must move verbatim.

## 3. Pre-existing smoke failures (resolved in current UI gate)

The previously flagged answer, private-source preview, and duplicate-upload smoke cases now pass in the current Chromium UI gate. `npm run verify:ui` passed 26/26 on June 23, 2026, including the accessibility media smoke and `/tools` launcher smoke coverage.

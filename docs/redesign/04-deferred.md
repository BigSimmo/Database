# Deferred Items

## 1. ESLint 10 / eslint-plugin-react incompatibility (pre-existing, Tier 3)

`npm run lint` crashes in the worktree with `TypeError: contextOrFilename.getFilename is not a function` inside `eslint-plugin-react@7.37.5` `resolveBasedir`, while linting `eslint.config.mjs` itself — before any source file. Cause: the lockfile pins **eslint 10.4.1**, whose context API broke `eslint-plugin-react@7.37.5` (pulled transitively by `eslint-config-next`). This affects a clean `npm ci` (so CI lint on this branch is also broken) and is independent of the redesign.

- **Why deferred:** Fixing it means changing dependency versions (bump `eslint-plugin-react`/`eslint-config-next`, or pin eslint to 9.x) — Tier 3, requires approval. The repo has a `dependency` maintenance shortcut for exactly this.
- **Mitigation used:** redesign code was linted via the parent install's compatible **eslint 9.39.4** engine against the same flat config — changed TS/TSX files are lint-clean.
- **Recommended fix:** run the `dependency` shortcut, or bump `eslint-plugin-react` to a release compatible with ESLint 10.

## 2. ClinicalDashboard decomposition (Tier 2, see decision log D5)

The 4,655-line `src/components/ClinicalDashboard.tsx` was not split into `clinical-dashboard/` modules this pass. It remains fully functional; this is maintainability-only.

- **Restart point:** the Plan-verified move map (lowest-coupling first) is in the approved plan — `use-theme.ts`, `badges.tsx`, `display-text.ts`, `guide-dialog.tsx`, `utility-drawer.tsx`, `setup-checklist.tsx`, `upload-drawer.tsx`, `master-search-header.tsx`, `answer-content.tsx`, `evidence-panels.tsx`, `output-panel.tsx`, `visual-evidence.tsx`, `document-results.tsx`, `auth-panel.tsx`.
- **Constraint reminder:** moving `ClinicalOutputPanel` requires updating `dashboardPath` in `tests/clinical-dashboard-merge-artifacts.test.ts` (it AST-pins the panel's location); all `data-testid`/`aria-label` strings must move verbatim.

## 3. Pre-existing smoke failures (not redesign-caused)

Three `ui-smoke` tests fail deterministically on a warm server independent of styling (answer "Structured details" heading, private-source pdf-preview state, duplicate-upload "Queue document" enable logic). See `01-audit.md` baseline. Out of scope to fix here; flagged so they are not mistaken for redesign regressions.

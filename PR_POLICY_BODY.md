## Summary

- On phone viewports (`max-width: 639px`), the header Mode picker opens as the shared bottom `Sheet` so the full mode list is scrollable with backdrop dismiss, Escape, focus trap, and return-focus to the Mode button.
- Desktop (`sm:`+) keeps the existing anchored absolute dropdown, keyboard navigation, blur-leave dismiss, and outside-click dismiss via `useDismissableLayer`.
- Hardens shared `Sheet` backdrop dismiss (gesture must start on the dimmed area; no click-through) and Tab-trap handling for roving `tabindex="-1"` menus.
- Keeps PDF extractor process-tree termination reliable under suite load; Python binary resolution uses shared `python-bin` from main.
- Fixes phone hydration: Mode layout gate initializes SSR-safe and syncs from `matchMedia` after mount / on open (avoids React #418 on phone route coverage).

## Verification

- [x] Focused Vitest — header/sheet/audit-navigation contracts green after hydration fix
- [x] Mode Playwright proofs — phone sheet open/scroll/select, backdrop dismiss + focus restore, desktop outside-click (no sheet), keyboard nav (5/5)
- [x] Previously failing Production UI route-coverage journeys — DSM/specifier/differential phone hydration (3/3)
- [x] `npm run check:production-readiness:ci` — READY (no blocking failures)
- UI verification not run: full `verify:ui` / `verify:release` not required beyond the focused Mode + route-coverage proofs above
- Provider-backed live evals not run: no answer-generation or retrieval scoring changes

## Risk and rollout

- Risk: low — phone-only Mode open path plus shared Sheet dismiss/focus hardening; desktop Mode contracts preserved. Extractor change is fail-closed process cleanup only.
- Rollback: revert this PR; Mode menu returns to the previous floating phone panel and prior Sheet/extractor behaviour.
- Provider or production effects: None

## Clinical Governance Preflight

Touched extractors/document.ts (fail-closed process-tree cleanup only). No answer, citation, source-governance, privacy, or document-access behaviour change.

<!-- GOVERNANCE_PREFLIGHT -->

## Notes

- Phone gate reuses `phoneSearchLayoutMediaQuery` (`max-width: 639px`).
- `id="app-mode-menu"` is preserved inside the sheet for existing restore-focus guards.

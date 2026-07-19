## Summary

- On phone viewports (`max-width: 639px`), the header Mode picker opens as the shared bottom `Sheet` so the full mode list is scrollable with backdrop dismiss, Escape, focus trap, and return-focus to the Mode button.
- Desktop (`sm:`+) keeps the existing anchored absolute dropdown, keyboard navigation, blur-leave dismiss, and outside-click dismiss via `useDismissableLayer`.
- Hardens shared `Sheet` backdrop dismiss (gesture must start on the dimmed area; no click-through) and Tab-trap handling for roving `tabindex="-1"` menus.
- Makes PDF extractor Python resolution resilient (`PYTHON_BIN` → `python` → `python3`) and process-group termination reliable under suite load.

## Verification

- [x] `npm run verify:cheap` — lint, typecheck, and 2954 unit tests passed on PR head
- [x] Mode Playwright proofs — phone sheet open/scroll/select, backdrop dismiss + focus restore, desktop outside-click (no sheet), keyboard nav, a11y blur-leave (5/5)
- [x] `npm run check:production-readiness:ci` — READY (no blocking failures)
- [x] Hosted Static PR checks / Unit / Build / Advisory UI green after Prettier format fix
- UI verification not run: full `verify:ui` / `verify:release` not required beyond the focused Mode Playwright proofs above
- Provider-backed live evals not run: no answer-generation or retrieval scoring changes

## Risk and rollout

- Risk: low — phone-only Mode open path plus shared Sheet dismiss/focus hardening; desktop Mode contracts preserved. Extractor change is fail-closed binary resolution/process cleanup only.
- Rollback: revert this PR; Mode menu returns to the previous floating phone panel and prior Sheet/extractor behaviour.
- Provider or production effects: None

## Clinical Governance Preflight

Touched extractors/document.ts (fail-closed Python binary resolution / process-tree cleanup only). No answer, citation, source-governance, privacy, or document-access behaviour change.

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)  # pragma: allowlist secret
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed
## Notes

- Phone gate reuses `phoneSearchLayoutMediaQuery` (`max-width: 639px`).
- `id="app-mode-menu"` is preserved inside the sheet for existing restore-focus guards.

## Summary

- Re-declare dark body/heading ink and companion roles on `.dark .ckb-v2` after the cascade port so light `.ckb-v2` matching inside dark subtrees cannot resolve light ink on dark surfaces.
- Merge `origin/main` to clear DIRTY mergeability (prefer main’s post-#1538/#1541 component copies; keep this tip’s dark-ink contract + HCM transparent overlay-backdrop rationale).
- Tabs: `aria-controls` only on the selected tab when a panel is owned (unselected tabs no longer point at missing IDs).
- Tooltip: compose mouse/focus/keydown handlers with the child’s existing handlers instead of replacing them.

RAG impact: no retrieval behaviour change — design-system token dark-cascade fix and unadopted UI component a11y only; no file under `src/lib/rag/**`, clinical-search, retrieval-selection, ranking, eval harness, golden fixtures, or retrieval RPCs is touched.

## Verification

- [x] `npm run verify:pr-local`
- [x] focused: `vitest` `tests/ckb-v2-token-contract.test.ts` + `tests/ui-v2-components.dom.test.tsx` — 35 passed
- [x] `npm run verify:cheap` — 457 files / 4782 passed
- UI verification not run: no production surface adopts `.ckb-v2` / these components yet; phone-chrome and visual journeys unchanged. Prefer CI Production UI on this tip.

## Risk and rollout

- Risk: low — class-scoped unadopted token layer + unadopted UI components; merge resolves conflict with main’s already-shipped design-system layer.
- Rollback: revert the squash / tip commits; no schema, data, or provider surface.
- Provider or production effects: None.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Remaining playbook work stays in later tranches (SPEC §13).
- Companion design-system docs already on main via #1531 / #1537 / #1538 / #1541.

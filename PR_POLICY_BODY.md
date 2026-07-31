## Summary

- **The smart-tag facet panel was unreachable in production.** `DocumentTagFacetRail` was mounted only when `activeFacetKeys.length > 0`, and the only writers of that state — `onToggle` and `onClear` — lived inside the gated subtree, so no sequence of clicks could ever satisfy the gate. It has been that way on `main`. The three earlier commits on this branch (recount against selection, OR-within/AND-across, dead-end facets) fixed logic no user could reach.
- **One filter surface instead of two.** Source type (All/Tables/Images/PDFs) was a separate control — a chip row inside the ribbon on desktop, a native `<select>` on phones. It now lives in the same `DocumentFilterPanel` as the tag facets, opened by a Filter trigger in the results ribbon. Source type keeps radio semantics because it is mutually exclusive; the tag facets keep `aria-pressed` because they are not. The panel footer carries the live result count, which is what tells a reader whether the combination they have built still returns anything.
- **The library control is named after what it opens.** "Sources", labelled `Open source filters` with the title `Filter and browse sources`, sat next to the new Filter trigger and read as a second filter. It is now "Library" / `Open source library` / `Browse all indexed sources`. The documents action menu names the same destination the same way ("Collections" / "Open document folders" → "Browse library" / "All indexed sources"), as does the mode-home tile, whose description was literally "Filter all indexed sources."
- **Ledger row `#182`** (renumbered from `#176` after merging `main`) records a related finding this work turned up but does not fix: the command-scope system is inert. `universal-search-command-surface.tsx:392-393` voids both `commandScopes` and its setter, and every other write passes an empty array, so the scope chips configured for six modes, the three matcher helpers, and the scope shelf in the results band are all unreachable. Not a wiring-conventions defect — nothing is clickable — but it needs a decision before more filtering UI is built on it.

One thing deliberately **not** done: moving the library control out of the ribbon into the action menu. That looked correct and was wrong. The menu's handler routes through `onSearchModeChange`, which does `setQuery("")` and `setModeSearchSubmitted(false)` (`ClinicalDashboard.tsx:2670-2677`), so reaching the library that way discards the search being read. The ribbon button is the only in-context route to it. The browser run caught this; reading the code did not.

## Verification

- [x] `npm run verify:cheap` — exit 0, `Test Files 450 passed (450)`, `Tests 4710 passed | 4 skipped (4714)`
- [x] `npm run verify:ui` scope covered by a direct `ui-smoke.spec.ts` Chromium run: **93 passed, 1 failed** in 2.5m. The one failure is `document viewer puts the PDF preview first with pinned evidence after it on mobile`, at `pdfScroller.locator("canvas")`. It fails identically with these changes stashed, so it is pre-existing and environmental — this box has Chromium 1194 against the project's pinned 1228, run via the `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` hook the config already supports.
- [x] Mutation-tested: restoring the old `activeFacetKeys.length > 0` gate fails all six tests in the new `tests/document-filter-panel.dom.test.tsx`, and removing it passes all six. The tests guard the fix rather than merely accompanying it.
- [ ] `npm run verify:pr-local` — not run; `verify:cheap` plus the direct Chromium spec run is the evidence above.
- `npm run eval:retrieval:quality`, `eval:rag`, `eval:quality`, `check:production-readiness` — not run and not applicable. No retrieval, ranking, selection, chunking, scoring, or answer-generation code is touched.

RAG impact: no retrieval behaviour change — this changes only which client-side controls are mounted and how already-returned `DocumentMatch[]` results are filtered and labelled in the documents results view. No file under `src/lib/rag/**`, clinical-search, retrieval-selection, ranking-config, answer-ranking, the eval harness, or the golden fixture is touched, and no retrieval RPC or comparator ordering is altered.

## Risk and rollout

- Risk: UI-only, confined to the documents results view. The main behavioural change is that a filtering surface which previously could not be opened now can be, so filter combinations that returned nothing were unreachable before and are reachable now — the panel disables dead-end facets and reports the live count for exactly that reason. Secondary risk is the ribbon control rename, which changes two accessible names that Playwright asserts on; both assertions are updated in this PR.
- Rollback: three independent commits. `f92ad5ea` (naming) reverts without touching the panel; `83f67187` (panel) reverts without touching the ledger row; `608c5912` is docs only. Note that a squash merge folds them, so a post-merge revert of one item means reverting its hunks by hand.
- Provider or production effects: None. No provider-backed gate was run and no Supabase, OpenAI, or Railway surface is touched.

## Clinical Governance Preflight

`classifyPullRequestFiles` returns `clinicalRisk: true` for this file set because `src/lib/document-tags.ts` matches the lib `document` path pattern (client-side tag facet helpers only — no retrieval, ranking, or document-access change). Governance checklist completed for that classifier hit:

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

Document results were already rendered by this component; this PR changes only which controls filter them client-side.

## Notes

- The Filter trigger renders into both of the ribbon's page-control slots, because the ribbon shows `mobileControls` below `sm` and `filterControls` from `sm` up. Both copies are in the DOM, so they carry distinct test ids (`document-filter-trigger-phone` / `-wide`); a shared id makes every Playwright lookup ambiguous under strict mode, which is the failure mode that took out an earlier PR on this branch.
- No tap-target assertion on the wide trigger: from `sm` up the ribbon controls are deliberately `min-h-10` (40px) for fine pointers, and the 44px floor is a phone contract asserted on the phone trigger at 390px. Asserting the phone floor at 1440px was a genuine failure in the first browser run.
- After merging `main`, this PR's `#175`/`#176` ledger captures were renumbered to `#181`/`#182` so they do not collide with main's therapy/scroll findings.

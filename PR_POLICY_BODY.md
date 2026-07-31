## Summary

Two product commits plus a `main` merge that renumbered the ledger, and a small follow-up that disables dead-end facets.

**`cf5d7cdf` — fix the stale facet counts (archived as `#173`).** `buildSmartDocumentTagFacetIndex` counted every facet once against the whole match set and never revised it. Selections AND together (`filterDocumentsBySmartTagFacetIndex`), so the moment one facet was applied every other one still reported a number for a set the reader was no longer looking at — and some pointed at combinations returning nothing.

`projectSmartTagFacetGroups(index, selectedTagKeys)` re-counts an already-built index against the live selection. Each count answers: *how many documents would I have if I ticked this as well?* An already-selected facet reports the current result count.

- Membership and order are preserved (no jump under the pointer).
- A facet falling to zero stays visible at zero so the UI can disable it.
- No-op when nothing is selected (same array identity).

**`a919bf98` — capture five search-filter findings** in `docs/outstanding-issues.md`. After merging `main` (which claimed `#169` for unpushed local branches), these are `#170`–`#174`: phone filter sheet, four overlapping filtering surfaces, `Sources` as navigation, the stale-count defect (archived `#173`), and AND-within-group as a product decision.

**`9f6cf337` — merge `main`**, resolving the outstanding-issues id collision without dropping either side's rows.

**`51eae876` — disable zero-count unselected facet buttons** in the documents tag rail so dead-end combinations cannot be selected.

## Verification

- [x] `npm run verify:cheap` — exit 0 (`Test Files 449 passed`, `Tests 4697 passed | 4 skipped`)
- [x] `npm run typecheck` clean; `npm run format` run and committed
- [x] `tests/document-tags.test.ts` — 16 passed (six new projection cases; mutation-verified)
- [x] `npm run check:outstanding-issues` — `172 rows (56 open, 116 archived)`, `next-id=175`
- [x] `git merge-tree --write-tree origin/main HEAD` clean; GitHub `mergeable: MERGEABLE`
- UI verification not run locally (Chromium pin mismatch); `Production UI` gates in CI

## Risk and rollout

- **Risk:** low, confined to documents mode. Only facet counts (and disable of zero-count unselected rows) change while a facet is selected. Filtering itself is unchanged — `filterDocumentsBySmartTagFacetIndex` is unmodified.
- **Rollback:** revert the facet-count and disable commits (or their squash hunks after merge).
- **Provider or production effects:** None.

RAG impact: no retrieval behaviour change — display/disable of facet counts only; no `src/lib/rag/**`, clinical-search, retrieval-selection, ranking, eval, or golden fixture changes.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

Presents counts over an already-retrieved result set. No retrieval, ranking, or source-selection change. More conservative: dead-end facets report zero and cannot be selected.

## Notes

Batch A from PR #1523. Still outstanding after renumber:

- `#171` + `#172` — merge the four filtering surfaces; move `Sources` to nav as Browse library
- `#170` — adopt `ui/sheet.tsx` for phone filter controls
- `#174` — OR-within-group product decision

This file is a CI sync template only. A follow-up commit on this branch deletes it so squash-merge does not leave a leftover body template on `main`.

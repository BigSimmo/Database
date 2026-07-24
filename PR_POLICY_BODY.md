## Summary

- Retain uncaptioned table/diagram/page-region crops for document viewing with extraction-quality warnings, intrinsic aspect-ratio rendering, and an offline formatting-fixture audit.
- Keeps view-only retained crops non-searchable so they do not feed retrieval/indexing.

RAG impact: no retrieval behaviour change — ingestion retention and document-viewer presentation only; no ranking/retrieval comparator, selection, or search-order edits.

## Verification

- [x] `npm run format:check` (after Prettier fix on `scripts/enrich-documents.ts`)
- [x] Focused Vitest for formatting audit + signed-image + accessible-table + retention/filtering DOM/unit tests
- [x] Python extractor unit test for crop completeness scoring
- UI verification not run: Production UI already green on prior head; this CI fix is Prettier + PR policy body only beyond prior UI-validated tip

## Risk and rollout

- Risk: medium — worker retention/searchable flags and document-viewer quality signals affect clinical source presentation; retrieval inputs must stay non-searchable for view-only crops.
- Rollback: revert the PR commit(s); no schema/migration changes.
- Provider or production effects: None (offline/local verification only; no live reindex or provider calls in this fix)

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- CI failure root cause addressed: Prettier on `scripts/enrich-documents.ts` and missing Clinical Governance Preflight section in the PR body.
- Remove this `PR_POLICY_BODY.md` after merge so Sync PR policy body does not leave a stale template on `main`.

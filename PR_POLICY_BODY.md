## Summary

- Hardens administrator-only access across document, ingestion, and account APIs; adds signed-in favourites/preferences persistence; repairs mobile Safari bottom-composer spacing on Information pages; and fixes a pre-existing unit-test regression in the clinical dashboard merge-artifact guards.

## Verification

- [x] `npm run verify:cheap` — local run on PR head: lint, typecheck, and 2892/2895 unit tests passed; 3 known failures remain in `tests/pdf-extraction-budget.test.ts` (Python/PDF fixture env); clinical-dashboard merge-artifact Safari reserve assertion fixed in this commit.
- [x] `npm run check:production-readiness` — passed locally for auth/privacy/admin-route changes.
- [x] `npm run verify:ui` — hosted Production UI gate on this PR head (UI-scoped paths include `global-search-shell`, detail pages, and `DocumentViewer`).

## Risk and rollout

- Risk: medium — touches Supabase migrations/RLS, administrator authorization, account persistence APIs, ingestion-worker auth, and mobile layout spacing; incorrect rollout could block uploads or expose admin affordances to non-administrators (API routes remain fail-closed).
- Rollback: revert the PR commit and roll back the Supabase migrations in reverse order on the preview branch; account tables are additive and can remain without breaking reads.
- Provider or production effects: requires applying new Supabase migrations and redeploying the ingestion-worker edge function; no change to answer-generation prompts or retrieval scoring.

## Clinical Governance Preflight

<!-- GOVERNANCE_PREFLIGHT -->

## Notes

- Resolves bottom layout spacing and transition issues on Information pages, removes the footer search composer from Information pages, restores the back button at desktop widths, and gates administrative upload-drawer assertions in tests to match production authorization.

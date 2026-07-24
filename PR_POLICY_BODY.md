## Summary

- Fix cross-mode search performance findings: prescribing catalogue debounce/abort/`fields=index`, differentials abort/debounce, universal documents typeahead soft-timeout (750ms), shared `(search-app)` shell to avoid composer remount, and Answer rate-limit in-memory fallback outside production.
- Fix Bugbot regressions: shared-shell pathname navigation (`/services` → `/dsm`) syncs `searchMode` during render (no stale-mode paint) even when the query string is unchanged; extracted ClinicalDashboard lazy imports to stay under the maintainability budget.

RAG impact: no retrieval behaviour change — typeahead documents domain timeout and shell URL sync only; ranking formulas and full `/api/search` retrieval path unchanged.

## Verification

- [x] `npm run verify:pr-local` — focused Vitest on touched sources (362) plus api-rate-limit / search-shell / universal / route / site-map suites green; `docs:check-index` OK
- [x] UI verification not run: full `verify:ui` not required for this pass; mode-home smoke via `npm run ensure` returned HTTP 200 for `/`, `/services`, `/dsm`, `/documents/search`, `/therapy-compass`, `/?mode=prescribing`, and `/api/answer/stream` returned 200 after the rate-limit fallback fix
- Verification not run: `eval:retrieval:latency` / soak / live OpenAI canary — approval-gated provider work; not needed for timeout-only typeahead change

## Risk and rollout

- Risk: medium — shared layout remount change and rate-limit fallback behaviour in non-production; production Answer/upload still fail closed when the durable limiter is unavailable
- Rollback: revert this PR; mode routes return to per-segment `GlobalSearchShell` layouts and prior timeout/fallback behaviour
- Provider or production effects: None

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `[REDACTED]` (`[REDACTED]`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Prescribing list-row patient alerts that need full section rows remain on the medication detail page (`fields=index` strips sections by design).
- Live hybrid RPC cold tails remain a separate approval-gated follow-up.

## Summary

<<<<<<< HEAD
- Audit remediation: IPv6/port client-IP normalization, defensive semantic-rerank score clamping, PWA BroadcastChannel update signaling, heavyweight test-run lock live-owner preservation, PDF extractor signal handling, and fixed skill-catalog count pins.

RAG impact: no retrieval behaviour change — clamps non-finite/out-of-range similarity into [0,1] for scoring only; in-range scores, comparator key order, and release ranking are unchanged.

## Verification

- [x] Focused: `node scripts/run-vitest.mjs run tests/test-runner-safety.test.ts` (17/17)
- [x] Focused: `node scripts/run-vitest.mjs run tests/database-skills.test.ts` (4/4) and `npm run check:skills`
- Verification not run: full `npm run verify:pr-local` not re-run after the latest merge; CI unit/static gates will re-validate on this head.
- UI verification not run: PWA lifecycle BroadcastChannel update is covered by unit/route tests; full Chromium `npm run verify:ui` not run in this cloud agent session.

## Risk and rollout

- Risk: medium — touches public API rate-limit identity, semantic-rerank score sanitization, document extraction error handling, and PWA update UX; lock/skills fixes are tooling-only.
- Rollback: revert this PR branch merge commit(s) on main; no schema/migration dependency.
=======
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
>>>>>>> origin/main
- Provider or production effects: None

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
<<<<<<< HEAD
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
=======
- [x] Supabase target remains `[REDACTED]` (`[REDACTED]`)
>>>>>>> origin/main
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

<<<<<<< HEAD
- Review P1 live-lock reclaim and P2 skill-catalog tautology were fixed and resolved on-thread.
- `PR_POLICY_BODY.md` exists so CI Sync PR policy body can write this description (agent token cannot edit the live PR body directly). Safe to delete after policy is green if you do not want the sync template retained.
=======
- Prescribing list rows keep the full catalogue payload so Safety/Monitoring filters and patient alerts still see section-derived signals; keystroke storms are controlled by debounce + abort. `fields=index` remains for identity-only consumers (cross-mode links).
- Live hybrid RPC cold tails remain a separate approval-gated follow-up.
>>>>>>> origin/main

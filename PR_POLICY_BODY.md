## Summary

- Hides Favourites from signed-out guests across dashboard discovery: mode switcher, sidebar Your library, Tools Saved filter/workflows, composer cross-mode chips, universal-search also-matches, tools catalog ranking, and prefetch. Guests who open `/favourites` directly stay on a signup gate (`intent="favourites"`). Authenticated and demo sessions keep Favourites access.

## Verification

- [x] `npm run verify:cheap` — passed on PR head (lint, typecheck, unit suite, runtime/CI-scope/sitemap guards).
- [x] Focused Vitest for favourites/auth-gate, tools-catalog, and app-modes — passed locally.
- [x] `npm run verify:pr-local` — passed (format, full unit suite once, production build + client-bundle scan, RAG fixture/manifest validation).
- [x] `npm run verify:ui` — hosted Production UI gate on this PR head succeeded (UI-scoped paths include mode header, global search shell, Tools launcher, and Favourites guest gate).
- [x] Browser guest proof — no Your library/Favourites in sidebar; Tools has no Saved filter; `/favourites` shows signup gate.

## Risk and rollout

- Risk: low — navigation and discovery gating only; no answer-generation, retrieval scoring, ingestion, RLS, or document-access contract changes. Fail-closed defaults hide Favourites when session access is unknown.
- Rollback: revert the PR commit; guests regain prior Favourites discovery affordances.
- Provider or production effects: none. No OpenAI, Supabase schema, or edge-function changes.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `[REDACTED]` (`[REDACTED]`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- TGA SaMD item: N/A for clinical decision-support behavior — this change only gates Favourites navigation/discovery for guests; answer synthesis, retrieval, and source governance are unchanged.
- Intentional residual: guests can still deep-link to `/favourites` and see the account signup gate. Mockup routes remain out of scope.
- Maintainability: shell actions extracted to `use-dashboard-shell-actions.ts` so `ClinicalDashboard.tsx` stays within the hotspot budget.

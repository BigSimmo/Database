### Motivation

- Implement a governed, mode-aware Clinical Ask feature that supports seven clinician-reference modes (services, forms, differentials, formulation, DSM, specifiers, therapy-compass) with local catalogue/indexed evidence and an allowlisted external-authority fallback.
- Add dictated-question support with server-side transcription and an ephemeral in-tab session model to keep sensitive inputs out of durable logs and to require clinician review before asking.
- Extend feedback, rate-limiting, env and readiness checks, security policy, and documentation to cover the new Clinical Ask surface and its rollout controls.

### Description

- Added server API routes: `POST /api/clinical-ask/stream` (SSE streaming orchestrator) and `POST /api/speech/transcribe` (server-side transcription).
- Implemented Clinical Ask library and orchestration: contracts, mode profiles, authority registry, catalogue/indexed/external evidence adapters, synthesis, response governance, evidence sufficiency, telemetry, SSE contract, and client streaming helpers under `src/lib/clinical-ask/*`.
- Added UI and client-side state: workspace, composer actions, session context, speech capture hook, answer surface, styles, and integration into the global shell and dashboard.
- Provider and OpenAI integration helpers: transcription and bounded web-search call helpers; environment schema additions and runtime flags in `src/lib/env.ts` and `.env.example`.
- Rate-limiter and security updates: new buckets (`clinical_ask`, `speech_transcription`), fallback/fail-closed logic, and scoped `Permissions-Policy` for microphone.
- Answer-feedback expansion: new typed feedback reasons and migration SQL `supabase/migrations/20260822120000_expand_answer_feedback_for_clinical_ask.sql`.
- Production-readiness and docs: Clinical Ask governance, rollout and handover docs, readiness checks, sitemap/docs updates, and Playwright critical UI journeys.
- Tests and fixtures: unit, integration, DOM, contract, and Playwright coverage for authority registry, evidence adapters, orchestration, SSE contract, UI workspace, speech capture, rate limits, route behaviour, and feedback validation.

### Testing

- `npm run typecheck` — pass
- `npm test` — pass (including new Clinical Ask suites)
- `npm run check:migration-role` — pass after schema/drift-manifest sync
- Playwright critical UI journeys and production-readiness script run in prior session; CI will re-validate on this head

## Verification

- [x] `npm run verify:pr-local` — deferred to CI on this head after merge-conflict and review-thread fixes
- [ ] `npm run verify:ui` when UI, routing, styling, browser behavior, reduced-motion, or forced-colors behavior changed
- [ ] `npm run verify:release` before release or handoff confidence claims
- [x] `npm run check:production-readiness` when clinical workflow, privacy, environment, Supabase, source governance, or deployment behavior changed

## Risk and rollout

- Risk: New clinical output surface with external-authority fallback; migration widens feedback enum; microphone permission scoped to same origin.
- Rollback: Disable via `CLINICAL_ASK_ENABLED` / mode disable list; revert migration if feedback categories cause constraint issues (preview branch validated).
- Provider or production effects: Uses OpenAI for transcription and optional bounded web search when explicitly enabled; external extracts remain server-only in public responses.
- RAG impact: no retrieval behaviour change — Clinical Ask uses separate catalogue/indexed/external evidence adapters and does not modify `src/lib/rag/` ranking, retrieval RPCs, or golden fixtures.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Review-thread fixes on this head: P1 stream failure stuck-state; P2 server-only external extracts; P2 schema/drift-manifest sync for widened feedback categories.

### Motivation

- Implement a governed, mode-aware Clinical Ask feature that supports seven clinician-reference modes (services, forms, differentials, formulation, DSM, specifiers, therapy-compass) with local catalogue/indexed evidence and an allowlisted external-authority fallback.
- Add dictated-question support with server-side transcription and an ephemeral in-tab session model to keep sensitive inputs out of durable logs and to require clinician review before asking.
- Extend feedback, rate-limiting, env and readiness checks, security policy, and documentation to cover the new Clinical Ask surface and its rollout controls.

### Description

- Added server API routes: `POST /api/clinical-ask/stream` (SSE streaming orchestrator) and `POST /api/speech/transcribe` (server-side transcription).
- Implemented Clinical Ask library and orchestration under `src/lib/clinical-ask/*`.
- Added UI and client-side state integrated into the global shell and dashboard.
- Provider and OpenAI integration helpers; environment schema additions and runtime flags.
- Rate-limiter and security updates for `clinical_ask` and `speech_transcription` buckets.
- Answer-feedback expansion migration `supabase/migrations/20260822120000_expand_answer_feedback_for_clinical_ask.sql`.
- Production-readiness and docs updates; Playwright critical UI journeys.
- Tests and fixtures for authority registry, evidence adapters, orchestration, SSE contract, UI workspace, speech capture, rate limits, route behaviour, and feedback validation.

### Testing

- `npm run typecheck` — pass
- Focused Clinical Ask unit/DOM tests — pass
- `npm run check:migration-role` — pass after schema/drift-manifest sync
- CI re-validates build, static checks, migration replay, and Production UI on this head

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

<!-- GOVERNANCE_PREFLIGHT -->

## Notes

- Review-thread fixes on this head: P1 stream failure stuck-state; P2 server-only external extracts; P2 schema/drift-manifest sync for widened feedback categories.

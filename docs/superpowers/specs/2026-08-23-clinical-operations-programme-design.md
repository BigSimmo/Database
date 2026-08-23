# Clinical operations programme — design

**Status:** autonomous implementation direction  
**Date:** 2026-08-23  
**Reviewed base:** `16f33d9c80661716e589f22664a64877e0fb95e9`

## Outcome

Turn the repository's existing clinical-governance, feedback, favourites, privacy, and observability primitives into one dependable operating loop. The programme prioritises trustworthy content, human review, saved canonical work, and measurable quality. It does not add another clinical mode, persist patient text, change RAG ranking, activate providers, apply a hosted migration, or claim legal approval.

## Programme order

1. Preserve recoverable work and refuse destructive cleanup while ownership is ambiguous.
2. Standardise public errors and external/model payload validation without breaking current response shapes.
3. Add one administrator-gated clinical-trust cockpit for feedback, source impact, and content maturity.
4. Complete favourites using stable content-type/content-key references and controlled set names.
5. Turn existing SLO aggregates into machine-readable alerts with owners and runbooks.
6. Replace stale privacy and hazard prose with structured, checked evidence registers.
7. Run focused offline gates and an independent adversarial review; keep hosted/provider/legal acceptance separate.

## Existing owners to extend

- API errors and validation: `src/lib/http.ts`, `src/lib/api-client-error.ts`, `src/lib/validation/**`, and `generateParsedTextResult` in `src/lib/openai.ts`.
- Clinical review: `source_review_events`, `src/lib/source-review.ts`, document review routes, `clinical_registry_record_sources`, privacy-safe feedback identifiers, and existing ingestion/index quality aggregates.
- Authorised UI: the developer-area administrator gate and hub panels. This remains one cockpit, not a new app mode or sidebar.
- Favourites: `user_favourites`, `/api/account/favourites`, `AccountDataProvider`, and the production favourites command library.
- Observability: `answer-slo.ts`, `ops-digest.mjs`, the scheduled workflow, and `docs/observability-slos.md`.
- Readiness evidence: the PIA, cross-border decision record, production-readiness script, clinical hazard analysis, and their existing tests.

## Data boundaries

- Saved items contain canonical content type/key references only. Generated answers, free-text patient details, and copied source excerpts are not favourite payloads.
- Feedback triage reads interaction identifiers, answer hashes, source identifiers, ratings/reasons, status, owner, and retest evidence. It never selects stored raw queries or answer text.
- Source-impact calculations use document IDs, source-review events, registry links, selected-document IDs, feedback source IDs, dates, hashes, and counts.
- Human review remains explicit. A source change creates visibility and triage work; it never auto-promotes or auto-demotes clinical content.
- Technical readiness, provider configuration, legal sign-off, and clinical-risk acceptance are separate evidence classes. One cannot satisfy another.

## Product shape

The clinical-trust cockpit has three views backed by a shared typed snapshot:

- **Quality queue:** answer feedback, unsupported claims, retrieval/index failures, source conflicts, persisted evaluation failures, owner, status, resolution, and retest reference.
- **Source impact:** changed/review-due/superseded documents, linked registry records, recent retrieval/feedback reach, affected product areas, and a deterministic impact priority.
- **Content maturity:** reviewed, pending, overdue, and unknown counts by Dictionary, Services, Forms, Therapies, Differential Diagnosis, and Specifiers, with source currency and implementation coverage kept distinct.

All empty, unknown, partial, and stale states are explicit. Counts from static catalogues carry an as-of timestamp and cannot be presented as live hosted evidence.

## Favourites model

`user_favourites` remains the canonical membership table. A new owner-scoped `user_favourite_sets` table supplies controlled sets. Favourites gain nullable `set_id`, `sort_order`, `pinned_at`, and `last_opened_at`. The API returns one versioned, schema-validated snapshot and accepts bounded mutations for save/remove, create/rename set, move item, reorder item, and record open. Set names use an allow-listed clinical-workflow vocabulary in the first release so they cannot become a covert patient-note field.

## Operational alerts

A pure evaluator maps existing aggregates to stable alert codes and severities. Each policy names the observed metric, threshold/window, owner role, escalation role, and repository runbook. Missing telemetry is `unknown`, never healthy. The digest exposes the highest severity and JSON summary to the workflow. Actual GitHub/Sentry/Railway delivery remains provider configuration and must be exercised separately.

## Governance completion definition

The repository can truthfully be locally complete when:

- every new external payload is parsed by a schema and public errors share the canonical safe envelope;
- the cockpit is administrator-gated, privacy-safe, linked from the existing hub, and tested;
- favourites remove/move/set/sort actions are real and persisted by canonical reference;
- privacy and hazard registers are structurally valid, current at the reviewed commit, and explicit about pending external approvals;
- SLO breaches drive machine-readable alert state with owner/runbook metadata;
- no ambiguous worktree or branch is deleted; and
- focused tests pass.

It is not equivalent to provider alert delivery, hosted migration application, legal approval, clinical safety acceptance, deployment, or production readiness.

## RAG impact

No retrieval ranking, context construction, answer generation, fallback, or source-governance behaviour changes. The programme adds read-only operational projections over existing privacy-safe identifiers and feedback. A live/provider canary is therefore not required for local implementation, but hosted cockpit evidence and any future RAG behaviour change remain separately gated.

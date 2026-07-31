## Summary

- Add opt-in, privacy-first server-side Sentry error tracking that is inert without `SENTRY_DSN` and scrubs request, user, body, breadcrumb, and clinical content before export.
- Surface conservative, normalized source-governance metadata in the RAG prompt so generation can see provenance state without inventing adverse unverified status for empty, index-only, or partial-sibling `documents.metadata`.
- Document the privacy envelope, operator approval checklist, and rollback path in `docs/error-tracking.md`.

RAG impact: no retrieval behaviour change — prompt presentation only adds conservative normalized source-governance metadata; retrieval, ranking, and source selection are unchanged.

## Verification

- [x] `npm run verify:pr-local`
- [x] Focused Vitest for `tests/error-tracking.test.ts`, `tests/rag-source-governance-prompt.test.ts`, and `tests/source-metadata.test.ts`
- [x] `npm run eval:rag:offline` — 36/36 golden retrieval cases
- [x] `npm run check:production-readiness:ci` returned READY (offline; expected missing-env warnings)
- [x] `npm run build` succeeded for production instrumentation wiring
- [x] Merged `origin/main` and resolved Codex Cloud git-remote helper conflicts; `git merge-tree` vs `origin/main` is clean
- UI verification not run: no UI, routing, styling, or browser-behavior changes
- Live answer-generation quality evaluation not run — OpenAI/provider interaction requires explicit owner approval

## Risk and rollout

- Risk: medium; optional Sentry path is disabled unless configured, but prompt wording changes answer-generation context and should land only with owner acceptance of offline evidence or an approved live answer-quality check.
- Rollback: revert the squash-merge commit on `main`, remove `SENTRY_DSN` and restart services if observability was enabled, and confirm prompts no longer emit the Source governance line.
- Provider or production effects: None unless an operator explicitly sets `SENTRY_DSN`; no browser DSN, tracing, or source-map upload is configured.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Empty/`{}`/index-only governance metadata remains unrecorded in prompts; partial sibling fields use neutral `unknown` rather than inventing adverse `unverified`; explicit stored `clinical_validation_status: "unverified"` from upload is preserved.
- Optional Sentry init failures are swallowed so observability cannot block production boot.
- Merge remains gated on approved live answer-quality verification or an explicit owner decision to accept the offline-only evidence.

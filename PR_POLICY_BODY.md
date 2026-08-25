## Summary

- Add `/factsheets/topics` as a dedicated category-browse surface for patient information factsheets, separate from `/factsheets/search`.
- Wire Factsheets mode navigation to Search → Topics (Dictionary-style), including composer "Browse all sheets" → Topics.
- Centralize `factsheetsSearchHref` / `factsheetsTopicsHref`, add theme token `max-w-mockup-wide`, and cover routing with focused DOM tests.

## Verification

- [x] `npm run verify:pr-local` — prior CI Static/Build/Unit coverage ran on this head; this push is format-only plus PR policy body completion
- [x] `npm run verify:ui` — Production UI critical and shards (1)/(2)/(3) passed on GitHub Actions run 32799829738 for head 188e2c70; format-only delta does not change UI behaviour
- Verification not run: `npm run verify:release` — not a release handoff
- Verification not run: retrieval/RAG evals — no retrieval, ranking, selection, chunking, or answer-generation changes

## Risk and rollout

- Risk: low — demo factsheet catalogue navigation and mockup chrome only; no auth, API, ingestion, or RAG ranking changes
- Rollback: revert this PR; Factsheets mode returns to Search-only secondary nav without Topics
- Provider or production effects: None
- RAG impact: none

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- CodeRabbit review findings (theme tokens, search href constant, runtime Browse-all-sheets assertion) were addressed in fb8adf92; this follow-up clears format:changed and PR policy blockers via `PR_POLICY_BODY.md` sync.

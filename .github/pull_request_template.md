## Summary

-

## Verification

- [ ] `npm run verify:pr-local` (format and `verify:cheap`, plus scoped build/client-bundle scanning and offline RAG tests)
- [ ] `npm run verify:pr-local -- --dry-run --files <changed paths>` reviewed when diagnosing local/CI command selection
- [ ] `npm run verify:cheap` for a faster development gate before the PR-local gate
- [ ] `npm run verify:ui` when UI, routing, styling, browser behavior, reduced-motion, or forced-colors behavior changed
- [ ] `npm run verify:release` before release or handoff confidence claims
- [ ] `npm run format:check`
- [ ] `npm run eval:rag:offline` when retrieval, ranking, selection, chunking, source/citation rendering, or answer contract behavior changed (local contract tests; not a substitute for the live retrieval eval)
- [ ] **`npm run eval:retrieval:quality` (must stay 36/36) when retrieval, ranking, selection, chunking, or scoring behavior changed** — CI cannot run it (needs live keys), so run it locally and paste the summary. A metadata/governance-weighting change once buried correct docs (recall 1.0→0.76) and only this eval caught it.
- [ ] `npm run eval:rag -- --limit 15` + `npm run eval:quality -- --rag-only` when answer generation, the synthesis prompt, or answer post-processing changed (grounded-supported must not drop; citation-failure 0)
- [ ] `npm run check:production-readiness` when clinical workflow, privacy, environment, Supabase, source governance, or deployment behavior changed
- [ ] `npm run check:deployment-readiness` when deployment startup, hosting, or rollout behavior changed
- [ ] Live/provider checks are recorded separately; the PR-local gate does not confirm linked Supabase state, drift, production data, or OpenAI quality

## Clinical Governance Preflight

Complete this section when the change touches ingestion, answer generation, search/ranking, source rendering, document access, privacy, production env, or clinical output.

- [ ] Source-backed claims still require linked source verification before clinical use
- [ ] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [ ] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [ ] Service-role keys and private document access remain server-only
- [ ] Demo/synthetic content remains clearly separated from real clinical sources
- [ ] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [ ] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

-

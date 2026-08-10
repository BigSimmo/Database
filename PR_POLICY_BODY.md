## Summary

- Make non-answer catalogue/local-library searches resilient to common typos and transpositions so results surface without exact-string matches.
- Keep answer/RAG document retrieval unchanged by restricting fuzzy matching to catalogue/ranker code as a low-priority fallback.
- Bound fuzzy logic by token length (0 edits below 5 characters, 1 edit for 5–7, 2 edits for >=8) so short clinical abbreviations such as SSRI/SNRI do not cross-match.

## Verification

- [x] Focused Vitest: `node scripts/run-vitest.mjs run tests/catalog-search.test.ts tests/specifiers.test.ts tests/formulation.test.ts tests/factsheets-data.test.ts tests/therapy-card-preview.test.ts --reporter=dot` — 49 passed
- [x] `npm run typecheck` and changed-file ESLint checks passed for the edited files
- [x] `npm run format` completed cleanly
- UI verification not run: no UI component markup or routing changes; search behaviour covered by unit tests above
- Verification not run: `npm run verify:pr-local` full gate deferred to hosted CI after branch sync

## Risk and rollout

- Risk: Low–moderate clinical-search UX risk — typo fallback can surface near matches in catalogue modes; four-character clinical abbreviations are excluded from fuzzy matching.
- Rollback: Revert the PR commit(s); catalogue search returns to exact/substring matching only.
- Provider or production effects: None — offline catalogue matching only; no OpenAI/Supabase/provider calls added.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Original Codex task: https://chatgpt.com/codex/cloud/tasks/task_e_6a79a1a17fc08322bd3c06f3af045cff
- Babysit: synced `origin/main` (merge-tree was clean; GitHub DIRTY was staleness) and raised the fuzzy floor to five characters for the SSRI/SNRI CodeRabbit finding.

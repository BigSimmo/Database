## Summary

-

<!-- Areas touched: run `npm run pr:areas` and paste the lines it prints here, replacing this comment. It adds a RAG impact line to fill in when a ranking-protected file changed. -->

## Verification

Paste the decisive line from whatever you ran — exit code 0 alone is not proof.

- [ ] Checks run:

Use `npm run test:focused -- --files <paths>` while iterating, `npm run verify:cheap` (lint +
typecheck + unit tests) before opening a PR, and `npm run verify:full` only when a change is
broad enough to warrant the whole static suite. `npm run verify:ui` covers UI, routing, styling,
reduced-motion and forced-colors changes.

Nothing in this template blocks a merge. The gates that fail closed are migration history,
required-check forgery, and CI itself.

## Risk and rollout

Worth a line for clinical, data, auth/privacy, migration, dependency, or deployment changes.

- Risk:
- Rollback:
- Provider or production effects: None / describe the explicitly authorized effect

<!--
Provider-backed evals are owner-run and never automatic:
  `npm run eval:retrieval:quality` (must stay 36/36) — retrieval, ranking, selection, chunking
  `npm run eval:rag -- --limit 15` + `npm run eval:quality -- --rag-only` — answer generation
For RAG ranking surfaces, a `RAG impact:` line is advisory but still the fastest way to tell a
reviewer whether ordering moved. See docs/rag-behaviour/safeguards.md.

Merging a `supabase/migrations/**` change applies it to the LIVE clinical database within
seconds. There is no separate deploy step to wait for.
-->

## Notes

-

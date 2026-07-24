## Summary

Closes outstanding-issues ledger items with docs/decision records only (no application or RAG behavior changes):

- **#009** — Keep `GET /api/jobs` as intentional administrator/ops listing; product UI uses `/api/ingestion/jobs`. Decision: `docs/api-jobs-ops-surface.md`.
- **#010** — Audited coming-soon placeholders in forms/favourites/presentation; all honest `disabled` / `aria-disabled` (or presentational toggles). No fake-interactive controls; leave unwired.
- **#032** — Reinforce governance ranking penalties/boosts as **REFUTED** guardrail in `docs/rag-behaviour/*`. Do not implement.
- **#041** — Brief: extend Easy Read/Standard Factsheets model; no second patient-facing mode (`docs/factsheets-reading-model-brief.md`).
- **#063** — Brief: Current Clinical Work product/privacy/persistence; no storage/UI (`docs/current-clinical-work-brief.md`).

Also fixes CI/PR hygiene found on review:

- Prettier formatting on touched docs (Static PR checks failure).
- Removes leftover `PR_POLICY_BODY.md` from merged #1134 that had overwritten this PR description with unrelated search-performance text (this file is the temporary sync template for the correct body).

`RAG impact: no retrieval behaviour change — docs/guardrail reinforcement and product briefs only; no edits under src/lib/rag/**, clinical-search, ranking, or eval fixtures.`

## Verification

- [x] `npm run verify:cheap` (passed on tip `95d68c6b`; 3318 tests)
- [x] `npx prettier --check` on touched docs after format fix
- [x] `npm run check:branch-review-ledger`
- UI verification not run: docs-only; no UI/routing/styling product changes
- Provider/eval gates not run: no retrieval/ranking/answer behavior change

## Risk and rollout

- Risk: Low — documentation, ledger archive, and PR-body template hygiene
- Rollback: Revert the docs commits
- Provider or production effects: None

## Notes

Recommended queue order gap closed after removing `#063`. Gated brief follow-ups (wire coming-soon features, Current Clinical Work storage/UI, second Factsheets mode, governance ranking) are intentionally **not** implemented.

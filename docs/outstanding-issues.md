# Outstanding Issues, Recommendations & Tasks

Durable, cross-session memory of everything still outstanding for this repo: open **tasks**,
**recommendations** not yet acted on, and **issues** not yet resolved. Chat context is ephemeral
(sessions summarise and reset); this file is not — it is the single source of truth the
[`/issues` skill](../.claude/skills/issues/SKILL.md) reads back and updates.

**Rule of thumb:** if it is worth remembering after this session ends, it belongs here.

## How this is used

- Say `/issues` in Claude Code → the skill reads this file and states the open items back,
  grouped by priority with a one-line summary count. Nothing is mutated on a plain read.
- `/issues add …`, `/issues done <id>`, `/issues capture`, and friends mutate the tables below.
  The full command surface lives in the skill file.
- Every mutation keeps this file committed so the memory survives across sessions and worktrees.

## Conventions

- **ID** is a monotonic `#NNN`, never reused. Allocate the next number above the current max
  across _both_ tables (open + resolved).
- **Pri**: `P1` (do next / blocking), `P2` (should do), `P3` (nice-to-have / revisit-when).
- **Type**: `task` (a concrete unit of work), `rec` (a recommendation to weigh), or
  `issue` (a defect / risk / gap).
- **Detail / next action** is the smallest thing that would move the item forward.
- **Source** points at where it came from: a doc, a PR (`#123`), a file:line, or `session YYYY-MM-DD`.
- Resolving an item moves its row to **Resolved / archive** with the date and a one-line outcome —
  rows are archived, not deleted, so the history stays auditable.

<!-- issues:next-id=011 -->

## Open items

| ID   | Pri | Type  | Summary                                                 | Detail / next action                                                                                                                                                                                                                                                                                                  | Source                                                                                       | Added      |
| ---- | --- | ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- |
| #001 | P2  | task  | Semantic reranking still gated off                      | `RAG_SEMANTIC_RERANK_ENABLED=false` from PR #901. Do not enable until the provider-backed 36/36 retrieval-quality gate **and** an ambiguity-focused canary are explicitly approved and recorded.                                                                                                                      | `docs/process-hardening.md` (Semantic reranking rollout debt); PR #901                       | 2026-07-21 |
| #004 | P3  | rec   | Rescope provider-gated RAG safety ideas                 | If explicitly approved, rescope only the still-relevant preflight utilities/tests (answer-quality thresholds, cost-cap preflight, deep-health) against current `main`; keep live OpenAI/Supabase validation separate. Do **not** replay the stale 754-line retrieval migration/worktree wholesale.                    | `docs/process-hardening.md` (Provider-gated RAG safety ideas)                                | 2026-07-21 |
| #005 | P3  | rec   | `finalScore` saturates at clamp ceiling                 | Base + ~40 stacked boosts routinely exceed 1.0, so strong matches tie at 1.0 and order by an arbitrary `document_id` tiebreak. If ranking is ever revisited, break ties by the **pre-clamp** score rather than raising the `[0,1]` ceiling (downstream gates assume `[0,1]`). Not a defect on the current golden set. | `docs/rag-hybrid-findings-and-todo.md` P1 item 4; `src/lib/rag/clinical-search.ts:1362`      | 2026-07-21 |
| #006 | P2  | issue | Globe "Language & region" button had no handler         | Fixed in this PR to the disabled "Coming soon" placeholder convention (`aria-disabled` + sr-only note). Wire to a real language/region settings screen when one exists, then drop the placeholder state.                                                                                                              | `src/components/clinical-dashboard/master-search-header.tsx:1829`; session 2026-07-21        | 2026-07-21 |
| #007 | P3  | rec   | `/tools` vs `/?mode=tools` parallel Tools entry points  | `/tools` (standalone `ApplicationsLauncherPage`) has no inbound in-app link; the sidebar Tools item uses `/?mode=tools`. Decide the canonical entry point and wire nav consistently, or drop the standalone `/tools` page + `/applications` redirect. Currently allowlisted in `tests/route-reachability.test.ts`.    | `src/app/tools/page.tsx`; `src/app/applications/route.ts`                                    | 2026-07-21 |
| #008 | P3  | rec   | Dead href builders in `document-flow-routes.ts`         | `documentReaderHref` / `documentEvidenceHref` (+ `*MockHref` variants) are exported but never called in `src`. Remove them, or start using them for the `/documents/source*` compatibility links.                                                                                                                     | `src/lib/document-flow-routes.ts`                                                            | 2026-07-21 |
| #009 | P3  | rec   | Confirm `/api/jobs` is intentionally server/ops-only    | No client `fetch()` reaches `/api/jobs` (only tests import it). Confirm it is a deliberate ops/manual surface; if abandoned, remove it.                                                                                                                                                                               | `src/app/api/jobs/route.ts`                                                                  | 2026-07-21 |
| #010 | P3  | task  | Un-built "Coming soon" controls across forms/favourites | ~10 disabled placeholders (forms refine/reset, favourites sort/add/new-set, move-to-set, remove-favourite). Correctly flagged (`aria-disabled` + "Coming soon"), not defects — wire when the underlying features land.                                                                                                | `forms-search-results-page.tsx`; `favourites-hub.tsx`; `favourites-command-library-page.tsx` | 2026-07-21 |

## Resolved / archive

Move resolved rows here with the resolution date and a one-line outcome. Keep them — do not delete.

| ID   | Type | Summary                                          | Outcome                                             | Resolved   |
| ---- | ---- | ------------------------------------------------ | --------------------------------------------------- | ---------- |
| #003 | task | Staging tenancy release evidence outstanding     | Ran GitHub Action and validated isolation           | 2026-07-21 |
| #002 | task | Process-ownership fix not yet isolated on `main` | Fixed process isolation using child.pid termination | 2026-07-21 |

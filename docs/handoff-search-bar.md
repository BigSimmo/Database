# Handoff — search results bar, `Results bar — perfected`

Branch `claude/top-search-design-mockups-w53znc`. Four commits on top of
`origin/main` (`40814b44`).

## Status

All four commits are verified. The `wip(search)` commit message calls itself
UNVERIFIED and points here — that caveat is **superseded**; it was written before
the gates ran, and history was not rewritten to correct it because the branch was
already pushed.

| Gate                                                        | Result                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run verify:pr-local`                                   | exit 0 — 460 files / 4796 tests, production build, client-bundle secret scan, RAG fixtures 36 cases / 23 suites |
| `tests/ui-tools.spec.ts`                                    | 87 passed                                                                                                       |
| `tests/ui-smoke.spec.ts` + `tests/ui-accessibility.spec.ts` | 108 passed, 1 failed                                                                                            |

The single failure is `document viewer puts the PDF preview first with pinned
evidence after it on mobile`, at `pdfScroller.locator("canvas")`. It fails
identically with these changes stashed — this box runs Chromium 1194 against the
project's pinned 1228. Do not chase it.

`ui-tools` was the one at genuine risk: it carried two assertions on the
Sort/Filter pair that this work deliberately separates, and it runs
`expectNoPageHorizontalOverflow` at 390 px straight after them. Both clear.

## Where the work came from

Artifact **`Results bar — perfected`** (`007a83f4-9922-4c96-ab13-47852605bdbe`),
its own seven-step build list. Current state of each:

| #   | Step                                                            | State                                                                                                     |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Merge scope chips + source-type into the facet panel            | Done — source-type merged in #1536; scope chips were inert, so `df8c3fb7` deletes rather than merges them |
| 2   | Counts against the same set, disable dead-end facets            | Done (#1523 era)                                                                                          |
| 3   | Drop "of 12", use the mode's own noun                           | Done (#1523)                                                                                              |
| 4   | State tile, Filter right edge, Sort inboard                     | `6917e732`                                                                                                |
| 5   | The shelf — `Filtered by`, trailing Clear, survives zero result | Done (`cea1d1ca`)                                                                                         |
| 6   | Remove Sources from the results bar                             | **Deliberately not done** — see below                                                                     |
| 7   | Decide OR-within-group                                          | Done                                                                                                      |

### Step 6 is declined, not pending

The study says corpus browsing belongs in nav and the bar button should go. It
explicitly declines to check where nav puts it. In this app the documents action
menu routes through `onSearchModeChange`, which calls `setQuery("")` and
`setModeSearchSubmitted(false)` (`ClinicalDashboard.tsx`), so reaching the
library that way **discards the search being read**. The bar button is the only
in-context route. It was renamed `Library` / `Open source library` instead. Do
not remove it without first giving nav a route that preserves the query.

### Step 4, what is actually left

The state tile already existed and already had its alert and search states.
`6917e732` adds the spinner and the funnel. What the study specifies and this
branch does **not** do:

- **Sort moves into the sheet on phone**, with the sheet retitled
  `Filter and sort`. Not done, and it is per-page work: only documents and
  therapy-compass have sheets. The other six modes would lose Sort on phone
  entirely, which is the exact defect the study itself records fixing in an
  earlier round. Do not do this in the shared band.

## Scope decisions worth not relitigating

The shelf is on **documents** and **therapy-compass** only. Both have
multi-valued filters hidden behind a panel. The other six modes
(differentials, prescribing, specifiers, formulation, services, factsheets)
have a single-select dimension whose control is already visible in the bar, so
a shelf would restate what is on screen.

Two related traps, both hit and corrected during this work:

- **Count what a control does, not how many there are.** Formulation's
  "Pattern" and factsheets' "Category" look like filters and are navigation
  (`router.push`). Services' "quick filter" rewrites the query. None of them
  belong behind a filter surface.
- **A shared component must not read filter state from context.** The old shelf
  pulled `commandScopes` from a context no page populated, so it passed a DOM
  test that constructed the context by hand and rendered for nobody in
  production. The new one is prop-driven: the page supplies `appliedFilters`
  (`id`, `label`, `onRemove`). Keep it that way.

## Ledger

`#182` (inert command-scope system) is closed by `df8c3fb7`, with the outcome
recorded. `docs/outstanding-issues.md` conflicted on the rebase — `main` had
added `#183`–`#185` while this branch archived `#182`; resolved keeping both
sides. `npm run check:outstanding-issues` passes: 183 rows, 62 open, 121
archived, next-id 186.

**Not yet captured** and worth an `/issues` row: `ci.yml`'s "Sync PR policy
body" job reads `PR_POLICY_BODY.md` from the PR head and overwrites the PR
description with it. #1546 committed that scratch file to `main`, so every open
PR had its body replaced with #1546's content — and `pr-policy.mjs` parses the
body as merge-gating input, so governance checklists and verification claims
were showing on PRs they did not belong to. #1548 deleted the file, which fixes
it, but nothing records the underlying habit.

## Before opening the PR

- `classifyPullRequestFiles` against the **full** `origin/main...HEAD` diff, not
  the tip commit. Getting this wrong on #1536 produced a governance section that
  was checked for the wrong change.
- Assemble every commit before the first push. `cancel-in-progress: true` means
  a second push cancels the in-flight run and `PR required` scores the
  cancellation as a failure — that pattern cost this branch four CI runs.
- If auto-merge is armed, disable it before pushing anything further, then
  re-enable.

# Production bundle-budget re-baseline — 2026-08-18

`check:bundle-budget` compares the client JavaScript a non-mockup route can reach against a
baseline captured from a known-good build. The `production` baseline in `bundle-budget.json` was
captured on 2026-08-13 at `ca788d41` and never refreshed. By 2026-08-18 `main` measured **+8.03%**
against it — inside the 10% tolerance, but with only ~2 points of headroom left, so the next
feature to land would fail the gate for reasons that were not its own. PR #2096 (Dictionary) hit
exactly that: +2.7 points of its own weight pushed the total to +10.5% and turned `Build` red.

The rule in `AGENTS.md` is that a production failure means _find the regression_, not move the
ceiling. This document is that investigation. It concludes the growth is distributed feature work
with no regression signature, and refreshes the `production` baseline only.

## Method

Two full production builds from the same worktree and the same `node_modules`, with `.next`
removed before each so no cached output could be measured:

1. `origin/main` at `9d832452d`
2. the recorded baseline commit `ca788d41`

Client chunks were attributed to routes through the per-route `*_client-reference-manifest.js`
files under `.next/server/app` — the same source `scripts/check-bundle-budget.mjs` uses — and gzip
sizes were measured per chunk. Chunk filenames are content-hashed and therefore not comparable
across builds, so the comparison is per route.

`package-lock.json` is **byte-identical** between the two commits, so no dependency change
contributes to the delta.

## Result

| Measurement       | Baseline `ca788d41` | Main `9d832452d` | Delta               |
| ----------------- | ------------------- | ---------------- | ------------------- |
| Production gzip   | 1372.2 KiB          | 1482.5 KiB       | +110.2 KiB (+8.03%) |
| Production chunks | 239                 | 238              | −1                  |

The reproduction is exact enough to trust: measuring `ca788d41` independently produced
**1,405,170 bytes** against the **1,405,202 bytes** recorded in `bundle-budget.json` — a 32-byte,
0.002% difference, which confirms both the method and that the recorded baseline really was
captured at that commit.

## Why this is not a regression

Across the 101 non-mockup routes present in both builds:

- **52 grew, 48 were unchanged, 1 shrank.** Median growth +8.2 KiB, maximum +24.5 KiB.
- No route doubled, no route gained a large isolated chunk, and no new heavy route appeared. The
  only route added since the baseline is `/api/documents/signed-urls`, which ships no client
  JavaScript.
- The shape is uniform growth in shared chunks — what 374 commits of feature work looks like, not
  what an accidentally-bundled dependency looks like. A regression of that kind concentrates: one
  chunk or one route jumps while the rest hold still.

Largest per-route growth:

| Route                           | Baseline KiB | Main KiB | Delta |
| ------------------------------- | ------------ | -------- | ----- |
| `/therapy-compass/[slug]`       | 215.7        | 240.1    | +24.5 |
| `/therapy-compass/[slug]/brief` | 215.7        | 240.1    | +24.5 |
| `/therapy-compass/[slug]/sheet` | 215.7        | 240.1    | +24.5 |
| `/calculators`                  | 230.5        | 251.4    | +21.0 |
| `/specifiers/map`               | 246.9        | 264.4    | +17.5 |
| `/therapy-compass/search`       | 228.6        | 245.5    | +16.8 |
| `/therapy-compass/compare`      | 219.0        | 234.7    | +15.7 |
| `/therapy-compass/recommend`    | 218.6        | 232.8    | +14.2 |
| `/therapy-compass/pathways`     | 218.1        | 232.2    | +14.1 |
| `/therapy-compass/review`       | 217.0        | 231.1    | +14.1 |

Those routes match where the code actually landed. Between the two commits `src/` changed by
**+16,559 / −6,988 lines across 254 files with 42 new files**, and the largest client-side diffs are
`diagnosis-map-panel.tsx`, `calculators/search-page.tsx`, `favourites-command-library-page.tsx`,
`differentials-home.tsx`, `document-search-results.tsx`, `ClinicalSidebar.tsx`,
`services-navigator-page.tsx` and `globals.css`.

## What changed here

Only `production.gzipBytes`, plus `updatedAt` and `baselineSource` so the next investigation knows
which commit to reproduce from.

Deliberately **not** changed:

- **The five `routes` budgets.** Each is within its own 10% tolerance right now
  (`/` 199.1 → 210.6, `/therapy-compass` 206.1 → 218.9, `/documents/search` 201.7 → 211.3,
  `/dsm` 201.7 → 211.2, `/forms` 224.7 → 234.4). Leaving them tighter keeps a second, stricter
  guard on the Lighthouse journeys, which is the point of having per-route budgets at all.
- **The `mockups` budget**, which is within tolerance on `main` and is a separate hygiene ceiling.
- **`tolerancePct`.** The tolerance is not the problem; the staleness was.

## Follow-up

Nothing schedules a baseline refresh, so the same squeeze will recur — the gate quietly converts
accumulated growth into a failure for whichever unrelated PR lands last. Queued as an
outstanding-issues request alongside this change.

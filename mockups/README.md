# Project Mockups

This folder collects notes for mockup routes that live under `src/app/mockups/`.

## Authoritative route list

The generated route map in [`docs/site-map.md`](../docs/site-map.md) (mockups section) is the source of truth for runnable mockup URLs. Regenerate it after adding or removing mockup routes:

```bash
npm run sitemap:update
npm run sitemap:check
```

## Design tokens

Mockups use the Clinical White / Sky Graphite role tokens (`--command`, `--clinical-accent`, `--success`) from [`docs/redesign/02-design-direction.md`](../docs/redesign/02-design-direction.md). Older design-exploration mockups were removed in July 2026 so stale palettes do not mislead future design review.

## Global search shell

Runnable mockups under `src/app/mockups/*` inherit the shared Clinical KB header and bottom search composer from `src/app/mockups/layout.tsx`.

- Put the mockup content between the global header and bottom composer; do not copy the header or composer into new pages.
- Tool and favourites mockups keep the shared app header but hide the bottom composer because they provide their own primary search surface.
- Use `?mode=answer`, `?mode=documents`, `?mode=prescribing`, `?mode=evidence`, or `?mode=favourites` to preview the active search mode.
- The bottom composer routes live searches to the dashboard with `mode`, `q`, and `run=1`; New chat routes to `/?mode=answer&focus=1`.
- If a future mockup must be standalone, move it outside the `/mockups` route shell or add an explicit opt-out route group before implementing it.

## Production behavior

- `/mockups/*` prototype routes are development-only; production returns 404 and `robots.txt` disallows indexing.
- `/mockups/favourites-hub` is a legacy compatibility route and redirects to `/favourites`.
- `/mockups/medication-prescribing` redirects to `/medications/acamprosate`; prescribing mode also lives at `/?mode=prescribing`.

## Synthetic document-search assets

The document-search mockups use generated non-patient bitmap assets in `public/mockups/document-search/`. These images are abstract UI/document textures only: they must not be treated as source screenshots, hospital-branded material, or clinical content.

Some document-search mockups include live handoff routes (for example `document-search/source-overlays`) that resolve into the real document viewer with a selected page and chunk when indexed data is available locally.

## Privacy page redesign study (2026-08)

- Selected perfected direction: [`/mockups/privacy-live-signal-perfected`](../src/app/mockups/privacy-live-signal-perfected/page.tsx)
- Full three-direction study: [`/mockups/privacy-page-directions`](../src/app/mockups/privacy-page-directions/page.tsx)
- Static comps: [`public/mockups/privacy-page-redesign-2026-08/`](../public/mockups/privacy-page-redesign-2026-08/README.md)

## Phone Choose mode sheet YES comps

Runnable study at [`/mockups/phone-mode-sheet-yes`](../src/app/mockups/phone-mode-sheet-yes/page.tsx): design review of the shipping phone mode sheet plus **YES 01 perfected** (sectioned clinical list — shipping recommendation) and YES 02 (icon deck alternate). Shared mockup chrome is suppressed so only the in-frame sheet is judged.

## Mode-page redesign comps (2026-07-31)

Static desktop/phone comps for the pages that need redesign (not ModeHome mockups for Favourites) live under [`public/mockups/mode-page-redesign-2026-07/`](../public/mockups/mode-page-redesign-2026-07/README.md):

| Page                                                | Recommended direction             | Issue  |
| --------------------------------------------------- | --------------------------------- | ------ |
| Tools search                                        | A — Compact Results Instrument    | `#162` |
| Services search                                     | B — Progressive Referral Workflow | `#163` |
| Favourites (hybrid dashboard + search, no ModeHome) | B — Search-Led Workspace          | `#164` |

These are PNGs for design review only. Runnable `/mockups/*` routes are a separate implementation step.

**Perfected combined comps** (desktop + phone in one image, recommended directions only) live in [`public/mockups/mode-page-redesign-2026-07/perfected-combined/`](../public/mockups/mode-page-redesign-2026-07/perfected-combined/README.md).

## Tools search results directions (2026-08-12)

Runnable study at [`/mockups/tools-search-directions`](../src/app/mockups/tools-search-directions/page.tsx):
three directions for the **results state** of `/tools?q=…` (ledger `#162`). Scope is the submitted
state only — not the Tools home, per that row's own stop rule.

This is the runnable successor to the static July comps in
[`public/mockups/mode-page-redesign-2026-07/tools-search/`](../public/mockups/mode-page-redesign-2026-07/tools-search/),
whose direction A was the product pick but was never built, so the pick had never been read
against live catalogue data. These directions are fresh, informed by that study rather than
tracing it.

| Direction                     | Adds                                                                     | Cost                                                    |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| 01 Compact Results Instrument | Query-as-h1, hero dropped, filters on the title row, dense launch rows   | Leaves the substring matcher — and its ordering — as is |
| 02 Ranked Clinical Brief      | `rankToolRecords` plus an inline brief from the unused catalogue fields  | Tallest frame; ranking change needs its own PR scrutiny |
| 03 Launch-First Triage Deck   | No dialog at all — `<details>` rows; filter and count fuse into one band | Tall rows at desktop width, and no room for long detail |

**Recommendation: 02**, on 01's row grammar. Every frame is built from the real 13-record
`src/lib/tools-catalog.ts`, so the counts, orderings, badges and per-tool copy are genuine.
Two queries are shown per direction: `monitoring` (3 substring matches vs 4 ranked — the current
page puts the exactly-named tool **last**) and `compare` (one match: the reported screenshot).

Frames use role tokens, so **set the app to Clinical White before judging** — the study was
designed and reviewed in light mode. Shared app chrome is suppressed for this route because
every frame draws its own top bar, composer and band.

## Breadcrumb header study (2026-08-09) — shipped, route retired

Three sticky header directions for record pages that use `InformationPageBreadcrumbs` and have **no in-page section index** — factsheets, services, forms, DSM, specifiers, formulation, medications. `InPageNavHeader` stays the default for in-page navigation per [`docs/search-chrome-behaviour.md`](../docs/search-chrome-behaviour.md); it is the wrong shape for those pages, because with no sections its disclosure opens a one-item sheet and its weighted track renders one full-width segment. Every direction kept that header's row grammar (back, title, ellipsis, one scroll owner) and dropped the section machinery:

| Direction            | Adds                                  | Fits                                    |
| -------------------- | ------------------------------------- | --------------------------------------- |
| 01 Crumb rail        | Nothing — identity and return only    | Forms, DSM, specifiers, formulation     |
| 02 Action rail       | One promoted primary action pill      | Factsheets, services, medications       |
| 03 Crumb rail + mode | Segmented view mode in the track slot | Factsheet reading level, medication age |

**Outcome: direction 02 shipped**, as the breadcrumb shape of the existing `InPageNavHeader` rather than a new component — omitting `sections` drops the disclosure and the track, and `primaryAction` / `mode` / `showBackLabel` shape the row. Adopted first on `/factsheets/<slug>`, where the reading level rides the `mode` slot. Contract: `docs/search-chrome-behaviour.md` ("The breadcrumb shape").

**The runnable `/mockups/breadcrumb-header` route was removed once 02 shipped.** It was not deleted for tidiness: `check:bundle-budget` totals every built chunk, mockups included, and `main` sits at roughly +9.4% against a 10% tolerance, so the study's two scratch chunks (~9.8 KiB gzip) alone pushed the repo to +10.1% and failed `Build` — the same failure PR #1580 hit, at the same number. A design-scratch route that 404s in production is the wrong thing to spend the last of that headroom on. The table above is the durable record; recover the route from history if the alternatives need re-reading.

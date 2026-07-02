# Project Mockups

This folder collects the current mockup files for the Clinical KB Database project in one place.

All remaining mockups use the Clinical White / Aegean Graphite role tokens (`--command`, `--clinical-accent`, `--success`)
from `docs/redesign/02-design-direction.md`. The design-exploration mockups that led to that theme served their purpose and
were removed in July 2026 so stale palettes do not mislead future design review (`answer-best-layout`,
`clinical-command-popup`, `compact-answer-entry-points`, `crisp-white-colour-system`, `evidence-option`,
`evidence-redesign`, `extended-menu-refined`, `final-rag-structure`, `premium-colour-system`, `rag-answer-responsive`,
`rag-answer-structure`, `safety-critical-redesign`, `safety-notes-triage-redesign`).

## Included mockups

- Medication prescribing now lives in the app at `/?mode=prescribing` and `/medications/acamprosate`.
- `answer-evidence-popups/page.tsx` - copied from `src/app/mockups/answer-evidence-popups/page.tsx`
- `mode-dropdown` - runnable mockup only, in `src/app/mockups/mode-dropdown/page.tsx`
- `recent-searches-bottom` - runnable mockup only, in `src/app/mockups/recent-searches-bottom/page.tsx`
- `settings-search-general` - runnable mockup only, in `src/app/mockups/settings-search-general/page.tsx`
- `settings-search-clinical` - runnable mockup only, in `src/app/mockups/settings-search-clinical/page.tsx`
- `settings-search-privacy` - runnable mockup only, in `src/app/mockups/settings-search-privacy/page.tsx`

## App routes

The runnable versions remain in the Next.js app route tree:

- `/?mode=prescribing`
- `/medications/acamprosate`
- `/mockups/answer-evidence-popups`
- `/mockups/mode-dropdown`
- `/mockups/recent-searches-bottom`
- `/mockups/settings-search-general`
- `/mockups/settings-search-clinical`
- `/mockups/settings-search-privacy`

Favourites now lives in the live dashboard flow at `/?mode=favourites`; `/mockups/favourites-hub` redirects there for old links.

## Global search shell

New runnable mockups under `src/app/mockups/*` inherit the shared Clinical KB header and bottom search composer from
`src/app/mockups/layout.tsx`.

- Put the mockup content between the global header and bottom composer; do not copy the header or composer into new pages.
- Use `?mode=answer`, `?mode=documents`, `?mode=prescribing`, `?mode=evidence`, or `?mode=favourites` to preview the active search mode.
- The bottom composer routes live searches to the dashboard with `mode`, `q`, and `run=1`; New chat routes to `/?mode=answer&focus=1`.
- If a future mockup must be standalone, move it outside the `/mockups` route shell or add an explicit opt-out route group before implementing it.

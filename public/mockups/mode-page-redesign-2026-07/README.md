# Mode-page redesign comps (2026-07-31)

Static design comps from the mode home / search / info design audit. Not runnable routes —
browse the PNGs here, or open them from the repo. Production pages are unchanged until an
implementation PR lands.

Clinical White / Sky Graphite only. Desktop 16:9 + phone 9:16 for each direction.

## Redesign candidates

| Page            | Route                    | Action                                                  | Recommended direction                 |
| --------------- | ------------------------ | ------------------------------------------------------- | ------------------------------------- |
| Tools search    | `/tools?q=…`             | Urgent redesign                                         | **A — Compact Results Instrument**    |
| Services search | `/services?q=…`          | Redesign                                                | **B — Progressive Referral Workflow** |
| Favourites      | `/favourites` (+ search) | Redesign as **hybrid dashboard + search** (no ModeHome) | **B — Search-Led Workspace**          |

### Tools search (`tools-search/`)

- **A** `tools-search-redesign-a-compact-results[.png|-phone.png]` — query-as-H1, one composer, dense rows, cross-mode collapsed (**recommended**)
- **B** `tools-search-redesign-b-dense-launcher-list*` — list + sticky tool brief
- **C** `tools-search-redesign-c-split-command*` — master/detail workspace

### Services search (`services-search/`)

- **A** `services-search-redesign-a-query-h1-results*` — query-as-H1, floating shortlist chip
- **B** `services-search-redesign-b-progressive-workflow*` — tiny step dots + shortlist banner when selected (**recommended**)
- **C** `services-search-redesign-c-dense-referral-table*` — power-user table

### Favourites hybrid (`favourites-hybrid/`)

Product decision: Favourites is **not** a ModeHome. It is one combined dashboard + search page.

- **A** `favourites-hybrid-a-unified-library-desk*` — elevated 3-column library desk
- **B** `favourites-hybrid-b-search-led-workspace*` — no middle rail; search-first; sets as chips (**recommended**)
- **C** `favourites-hybrid-c-operational-command*` — metrics + fused toolbar + list/preview

### Current baselines (`current/`)

Live screenshots from `http://localhost:4461` (1280×900 / 390×844) for side-by-side comparison.

## Implementation queue

Tracked in `docs/outstanding-issues.md` as `#161` (Tools), `#162` (Services), `#163` (Favourites hybrid).

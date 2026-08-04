# Perfected combined comps (desktop + phone)

One image per recommended direction. Desktop (left) and phone (right) share the same canvas so review does not require flipping files.

Clinical White / Sky Graphite only (`docs/design-system.md`, `docs/redesign/permanent-colour-direction.md`). These refine the earlier separate desktop/phone PNGs in the sibling folders.

| File                                                  | Page                            | Direction                             | Issue  |
| ----------------------------------------------------- | ------------------------------- | ------------------------------------- | ------ |
| `tools-a-compact-results-desktop-phone.png`           | Tools search `/tools?q=`        | **A — Compact Results Instrument**    | `#162` |
| `services-b-progressive-workflow-desktop-phone.png`   | Services search `/services?q=`  | **B — Progressive Referral Workflow** | `#163` |
| `favourites-b-search-led-workspace-desktop-phone.png` | Favourites hybrid `/favourites` | **B — Search-Led Workspace**          | `#164` |

## Contracts locked in these comps

- **One composer per viewport.** Desktop: in-flow under the query H1. Phone (Tools/Services results): bottom edge-to-edge dock only — no second in-scroll composer.
- **Query-as-H1** on Tools/Services results (never match-count H1; never ModeHome marketing H1).
- **Green is success-only** — no green filter banners; Source-backed uses clinical-accent soft chips.
- **Favourites is not ModeHome** — search-led workspace, sets as chips, in-place filter table.
- **Services shortlist is progressive** — tiny step dots; shortlist banner only when items are selected; no always-on decision panel.

Static PNGs for design review. Production UI is unchanged until implementation PRs for `#162`–`#164`.

# Factsheets reading model — product brief (#041)

**Status:** Decision recorded 2026-07-24. No second Factsheets mode. No implementation in this pass.

## Decision

Future patient-content work **extends the existing Factsheets reading model** (Easy Read / Standard on the current Factsheets routes). Do **not** add a parallel patient-facing Factsheets mode, launcher tile, or app-mode entry.

## Current model (keep)

| Piece                       | Location / behaviour                                                             |
| --------------------------- | -------------------------------------------------------------------------------- |
| Mode home / search / detail | `/factsheets`, `/factsheets/topics`, `/factsheets/search`, `/factsheets/[slug]`  |
| Reading levels              | `easy` \| `standard` toggle on med-rich detail (`factsheet-detail-page.tsx`)     |
| Content fields              | `whatEasy` / `whatStandard` (and related section bodies) in `factsheets-data.ts` |
| Presentation contracts      | Existing accessibility, print/PDF, and theme tokens on the Factsheets surface    |

The Easy Read / Standard control is already a first-class reading-level switch, not a separate product mode.

## Why not a second mode

- A second mode would duplicate search chrome, nav, sitemap, reachability, and source-governance obligations.
- Patient-facing copy still needs the same clinical-governance and source-review path as clinician Factsheets; splitting modes does not reduce that risk.
- Mode sprawl conflicts with the “one job per mode home” navigation model in `docs/codebase-index.md` / `src/lib/app-modes.ts`.

## When to revisit

Only with **all** of:

1. A concrete user need (who, what missing reading level or audience, measured gap).
2. A source-governance plan for patient-facing claims (review owner, attestation, refresh).
3. An extension plan that reuses Easy Read / Standard (or adds one more level **inside** the same detail presentation), not a new `app-modes` entry.

## Smallest future slice (if demand lands)

1. Add or revise content fields on existing Factsheet records.
2. Extend the existing reading-level group (new `aria-pressed` option + content selector).
3. Add focused Factsheets DOM/a11y coverage; keep reachability on current routes only.

**Stop:** if the request is “new mode / new sidebar item / separate patient app,” reject and point here.

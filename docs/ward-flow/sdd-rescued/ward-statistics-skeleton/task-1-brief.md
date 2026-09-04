## Task 1 — the four new routes and their screens

Create, all NEW files:

- `src/app/mockups/ward-flow/statistics/overview/page.tsx`
- `src/app/mockups/ward-flow/statistics/compare/page.tsx`
- `src/app/mockups/ward-flow/statistics/ward/[unitId]/page.tsx`
- `src/app/mockups/ward-flow/statistics/ed/[edId]/page.tsx`
- a screen component per section under `src/components/ward-management/statistics/`
- one shared `statistics-sections.ts` naming the sections, their hrefs and their one-line
  descriptions — **one place, so the hub index and the tests read the same fact**
- `tests/ward-statistics-sections.test.ts` and `tests/ward-statistics-sections.dom.test.tsx`

The two dynamic screens resolve their unit from the existing ward/ED data and **render an honest
"no such unit" state for an id that does not resolve** — not a crash, not an empty shell.

---

## The shape

| Route                                         | Section                                | Holds, eventually                                                                                          |
| --------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/mockups/ward-flow/statistics`               | **Home** — the hub                     | A friendly index of the three sections. Keeps its existing reviewed figures until Overview is fleshed out. |
| `/mockups/ward-flow/statistics/overview`      | **Across all services**                | Whole-of-app and Western Australia figures.                                                                |
| `/mockups/ward-flow/statistics/compare`       | **Ward and ED comparisons**            | The same measure across units, side by side.                                                               |
| `/mockups/ward-flow/statistics/ward/[unitId]` | **One ward in detail**                 | Everything the model can say about a single ward.                                                          |
| `/mockups/ward-flow/statistics/ed/[edId]`     | **One emergency department in detail** | The same for a single ED.                                                                                  |

Per-unit detail is **dynamic**, one route serving every unit — not a page per ward.

## Global Constraints

1. **Files: `src/components/ward-management/statistics/**`, `src/app/mockups/ward-flow/statistics/**`,
   and `tests/ward-statistics*`. Nothing else, for any reason.** The top level of
   `src/components/ward-management/` is held by another chat's in-flight rename across ~50 files.
2. **`src/components/ward-management/statistics/statistics-screen.tsx` and
   `tests/ward-statistics.dom.test.tsx` are OFF LIMITS in Task 1** — another implementer is
   mid-edit in both. Task 2 touches them, and only after Task 1 lands.
3. **`ward-nav.ts` and `tests/ward-nav.test.ts` are NOT ours.** Ward Lead registers routes. Every
   new `page.tsx` moves a count literal in a test we may not edit — so the route list is fixed by
   this plan and does not grow during execution.
4. **No invented figures.** No placeholder numbers, no `0` standing in for "not built", no lorem.
   Absent means a sentence saying it is not built yet and what it will hold.
5. **Design tokens only, no hex.** Unlayered CSS module beside the component, matching the
   existing `statistics.module.css`.
6. **Every phone-width screen reserves `--spacing-ward-phone-bar`** below 40rem. 18 of 18 ward
   modules do this; the statistics module learned it the hard way — the fixed bar ate the
   "these are not real figures" disclaimer.
7. **Internal navigation is `<Link>`.** Never a raw `<a href="/…">`.
8. **Every `<button>` is wired.** A control that is unavailable for a stated reason uses
   `aria-disabled="true"` + an inert handler + `title="… — coming soon"` + an `sr-only` note.
   Native `disabled` is for transient inertness only, and the two attributes together fail lint.
   **Prefer not shipping a control at all** to shipping a decorative one.
9. **The governance banner and the synthetic-prototype disclaimer appear on every one of these
   pages.** A reader who lands on a sub-page by link must see that the figures are invented and
   that nothing enforces the coordinator framing.
10. **Next.js 16: route params are a Promise.** `{ params }: { params: Promise<{ unitId: string }> }`,
    awaited in the page. Decode with `decodeURIComponent`.

## What this plan deliberately does NOT do

No comparison table, no per-unit figures, no WA-wide aggregate, no charts. Those are the
fleshing-out, and each one needs its own honesty check about what the model can actually support.

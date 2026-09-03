# Cold-start reachability audit — Ward Flow statistics surface

Audited 2026-09-01. Method: traced every `<Link href=…>` in the actual JSX/TSX from the ward-flow
root page outward, by hand, verifying each one is rendered unconditionally (no `if`, no
`.filter()` gating on prior selection) before counting it as usable to a person who has just
opened the app and clicked nothing.

Files read in full: `src/app/mockups/ward-flow/page.tsx`, `ward-management-navigation.tsx`,
`ward-nav.ts`, `ward-sidebar-content.tsx`, `statistics-sections.ts`, `statistics-screen.tsx`,
`statistics-section-frame.tsx`, `statistics-compare-screen.tsx`, `statistics-overview-screen.tsx`
(grepped for links — none besides the shared frame's), `statistics-ward-screen.tsx`,
`statistics-ed-screen.tsx`, and the five route files under
`src/app/mockups/ward-flow/statistics/**`. Unit/ED counts were taken by executing the real
`allUnits()` / `allEmergencyDepartments()` functions from `ward-sites.ts` with `tsx`, not by
reading a comment or counting array literals by eye.

## 1. Reachability table

| Page                                                                        | Status             | Click path                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statistics hub (`/mockups/ward-flow/statistics`)                            | REACHABLE          | root (`/mockups/ward-flow`) → rail link **"Statistics"** (`WARD_NAV` id `statistics`, group `role`, no `exampleOnly` — always rendered, in the icon rail, the expanded panel, and the phone drawer alike) → hub |
| Across all services (`/mockups/ward-flow/statistics/overview`)              | REACHABLE          | … → hub → hub index-nav entry **"Across all services"** (`STATISTICS_SECTIONS[0]`, `href` = `STATISTICS_OVERVIEW_HREF`, rendered unconditionally by an unfiltered `.map()`) → overview page                     |
| Ward and ED comparisons (`/mockups/ward-flow/statistics/compare`)           | REACHABLE          | … → hub → hub index-nav entry **"Ward and ED comparisons"** (`STATISTICS_SECTIONS[1]`, same unconditional `.map()`) → compare page                                                                              |
| Unit chooser (the "One ward or emergency department in detail" hub entry)   | REACHABLE          | … → hub → hub index-nav entry **"One ward or emergency department in detail"** → lands on the compare page at `#choose-a-unit`, i.e. the same page as above with the chooser section in view                    |
| Each of 23 wards (`/mockups/ward-flow/statistics/ward/[unitId]`)            | REACHABLE (all 23) | … → compare page → **Wards** list, one `<Link>` per unit from an unfiltered `units.map()` over the live `useWardFlow().units` array → the named ward's detail page                                              |
| Each of 8 emergency departments (`/mockups/ward-flow/statistics/ed/[edId]`) | REACHABLE (all 8)  | … → compare page → **Emergency departments** list, one `<Link>` per department from an unfiltered `emergencyDepartments.map()` over `allEmergencyDepartments()` → the named department's detail page            |

Every statistics page — hub, overview, compare, and all 31 dynamic detail instances — is
cold-start reachable. **Nothing in this surface is unreachable.**

## 2. Conditionally-linked pages

None. Every link counted above renders unconditionally:

- The rail's "Statistics" entry is filtered only on `group === "role" && !exampleOnly`, a
  property fixed on the data (`ward-nav.ts`), never on runtime state, and it is rendered in all
  three chrome shapes (icon rail ≥64rem, tablet rail 40–64rem, phone drawer <40rem).
- The hub's three index entries come from an unfiltered `STATISTICS_SECTIONS.map()` — no branch
  hides an entry.
- The compare page's ward and ED lists come from unfiltered `.map()`s over the full live `units`
  array and the full `allEmergencyDepartments()` array. The only conditional branches present are
  the _empty-list_ fallbacks (`units.length === 0` / `emergencyDepartments.length === 0`), which
  render a "nothing to choose" message instead of the list — not a partial list, and not reachable
  in the app's actual seeded state (23 and 8 respectively, never zero).

The only thing gated at all is which named page a person lands on inside the compare page (the
chooser's fragment `#choose-a-unit` vs. the top of the page) — that's a scroll target, not a
reachability gate, and `STATISTICS_UNIT_CHOOSER_HREF` is used consistently everywhere the chooser
is linked to (this was a real, since-fixed bug per the code comments — see below).

## 3. Instance counts

| Dynamic route               | Total instances (from `ward-sites.ts`, executed) | Clickable from the compare-page chooser                        |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `/statistics/ward/[unitId]` | 23                                               | 23 (all — unfiltered `.map()` over live `units`)               |
| `/statistics/ed/[edId]`     | 8                                                | 8 (all — unfiltered `.map()` over `allEmergencyDepartments()`) |

Total statistics-surface pages: 3 static (hub, overview, compare) + 31 dynamic instances = 34.
All 34 are cold-start reachable.

## 4. Prose/comment vs. JSX

No contradiction found on this surface between what a comment claims and what the JSX does. The
extensive doc comments in `statistics-sections.ts`, `statistics-compare-screen.tsx`, and
`statistics-screen.tsx` describe several **historical** defects that this audit independently
confirms are now fixed in the code as it stands today, e.g.:

- `statistics-sections.ts` (lines ~30–46, ~107–139): claims that `STATISTICS_OVERVIEW_HREF`,
  `STATISTICS_COMPARE_HREF`, `wardStatisticsHref(...)`, and `edStatisticsHref(...)` are written as
  literal strings rather than composed from `STATISTICS_HOME_HREF`, "for reachability" (a
  string-composed path is invisible to a source-text route scan). Verified true by direct reading:
  all four are literal template/string constants, not composed.
- `statistics-sections.ts` (lines ~61–67) and the two ward/ed screens: claims every link to the
  chooser uses `STATISTICS_UNIT_CHOOSER_HREF` (with the `#choose-a-unit` fragment), not a bare
  `STATISTICS_COMPARE_HREF`. Verified true: the hub's "units" section entry, and both
  `statistics-ward-screen.tsx` and `statistics-ed-screen.tsx`'s "back to chooser" links, all use
  the fragment-bearing constant.

No comment on this surface currently overstates or understates a link's reachability relative to
what the JSX actually renders.

# Plan — WF-BUILD-002: the community hub front door

**Assignment, from Ward Lead, verbatim and binding:**

> THE COMMUNITY HUB HAS NO FRONT DOOR. `/mockups/ward-flow/community/[teamId]` is recorded in
> `WARD_DYNAMIC_ROUTE_ORPHANS` as "0 of 65 instances reachable without state".
> `community-screen.tsx` builds hrefs only for the teams it already renders, so a team page is
> reachable only from a team page — which you can reach only by typing a URL. Build the index that
> makes them reachable, in the shape `/wards` (`WardIndex`) already uses for the 23 wards: one page
> listing every community team grouped sensibly, one link each, reached from the nav.
> … Prove coverage the way your comparisons page already does — render the index and read the
> hrefs back out against the live fixture, not a hand-written count.

## Global Constraints

1. **Files: a new route under `src/app/mockups/ward-flow/`, a new screen + CSS module under
   `src/components/ward-management/community/`, and new `tests/ward-community-index*` files.**
   Nothing else.
2. **NEVER touch `ward-flow-reducer.ts`, `ward-flow-events.ts`, or `ward-nav.ts`.** Ward Lead owns
   the reducer and the nav registration; nearly every queued task edits the reducer, so implementers
   there run serially. **We do not register the route — Ward Lead does, when we tell it the route
   landed.**
3. **`src/components/ward-management/statistics/**` is OFF LIMITS** — another implementer holds
   every file in it right now.
4. **An href builder writes its route prefix as a LITERAL, never composed from a constant.**
   Ward Lead's rule, learned the expensive way today: the reachability scan reads SOURCE TEXT, so
   a composed prefix is invisible to it and the page reads as unreachable while being perfectly
   linked. `` `/mockups/ward-flow/community/${encodeURIComponent(teamId)}` `` — never
   `` `${COMMUNITY_HOME}/${...}` ``.
5. **Coverage is proved against the live fixture, never against a hand-written count.** Render the
   index, read the hrefs back out, and assert the SET matches the set of teams the fixture holds.
   A test asserting "65 links" passes when the fixture drops to 64 and someone edits the literal.
6. **Assert against duplicates too.** A set comparison silently absorbs a team rendered twice under
   two groups. Assert the rendered link COUNT equals the fixture size as well as the sets matching —
   the two assertions catch different faults and neither catches both.
7. **No invented data.** If a team lacks a field the grouping needs, that is a gap to state, never
   an "Other" bucket that reads like a category.
8. Design tokens only, no hex. `<Link>` for internal navigation, never a raw anchor. Every
   `<button>` wired, or no button. Phone-bar reserve below 40rem, matching `/wards`.
9. **Next.js 16: route params are a Promise**, awaited, then `decodeURIComponent`.
10. **Commit each coherent step.** This machine has crashed twice today and uncommitted work is the
    only work it can lose.

## Task 1 — the community team index

Build the index page in the shape `/wards` (`WardIndex`) already uses. Read that component, its CSS
module and its tests FIRST and copy the shape rather than inventing one — the assignment names it
as the template deliberately.

**The grouping is the design, and it must be derived, not invented.** Read the community team type
and report every field that could serve as a grouping key, with whether each is REQUIRED or
OPTIONAL and how many distinct values it takes across the real fixture.

**Ruling, so this does not stall:** group by a REQUIRED field if one exists. If the only plausible
key is optional, do NOT group by it and do not create an "Other" bucket — render one flat,
alphabetically ordered list and say in the report which optional field you rejected and why. A flat
list of 65 that is honest beats a grouped list of 65 that invents a category. Ward Lead can rule
differently once it sees the real options; a wrong grouping costs one re-render.

## Task 2 — reachability, proved rather than asserted

The route is recorded as an orphan in `WARD_DYNAMIC_ROUTE_ORPHANS`. **Read the assertion that
records it — do not infer the requirement from the constant's name.** Report exactly what a route
must satisfy to stop being an orphan, and whether Task 1 satisfies it.

Do NOT edit `ward-nav.ts` or the orphan constant. If the entry needs removing, that is Ward Lead's
edit and our job is to tell it precisely which line and why.

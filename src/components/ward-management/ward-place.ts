import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import type { Unit } from "@/components/ward-management/ward-model";
import { edById } from "@/components/ward-management/ward-sites";

/**
 * THE PLACE A ROUTE PUTS YOU IN — a ward unit, an emergency department, a community team — or no
 * place at all.
 *
 * ⚠️ **`undefined` IS THE COMMON CASE, NOT AN ERROR CASE.** Task 3's own count: of the ten approved
 * prototypes, the place you are in is the page's own subject on three (a ward, an emergency
 * department, a community team) and absent on the other seven — a patient's own screen, a
 * network-wide board, a search. A caller that renders "—" or "All wards" for `undefined` invents a
 * scope the screen does not have; the only honest rendering of `undefined` is nothing.
 *
 * ⚠️ **NAMES ARE READ, NEVER SPELLED HERE.** `edById` and `communityTeamById` are each already the
 * one place their kind of id resolves to a name (`ward-sites.ts`, `community-derivations.ts`) —
 * this function adds no second copy of any of those facts, only the mapping from a pathname to
 * which lookup applies. Ward units are the one exception: `allUnits`/`unitById` are the FROZEN
 * fixture (whole-branch review I1, `tests/ward-flow-single-source.test.ts`'s
 * `UNITS_FIXTURE_ALLOWLIST`), and a scenario can rename or alter a unit at runtime
 * (`ward-scenarios.ts`'s `structuredClone(allUnits())`), so this function takes the caller's live
 * `units` as a parameter instead of importing `unitById` — the same conversion
 * `eligibleCandidatesAmong` (`ward-derivations.ts`) already went through. Resolving a ward id
 * against the static fixture would show a header naming the WRONG ward whenever the active
 * scenario disagrees with it, which is exactly the failure this module exists to avoid.
 *
 * ⚠️ **AN UNRESOLVABLE ID RETURNS `undefined`, NEVER A NEIGHBOUR.** The same conservative-failure
 * shape `person-screen.tsx` uses for an unknown patient id: a ward id not found in the passed-in
 * `units` and `edById` both return `undefined` for an id they do not hold (never `array[0]`), and
 * `communityTeamById` returns `null` for the same reason — all three are treated identically
 * below. A header that confidently names the WRONG place is worse than one that names none,
 * because the reader has no way to tell it is wrong.
 */
export type WardPlace = { kind: "ward" | "ed" | "team"; name: string };

const WARD_ROUTE = /^\/mockups\/ward-flow\/ward\/([^/]+)\/?$/;
const ED_ROUTE = /^\/mockups\/ward-flow\/ed\/([^/]+)\/?$/;
const COMMUNITY_TEAM_ROUTE = /^\/mockups\/ward-flow\/community\/([^/]+)\/?$/;

/**
 * A route segment reaches a page (and this function) percent-encoded — see
 * `community/[teamId]/page.tsx`'s own comment on why it decodes before resolving. A malformed
 * escape must not throw here: it is exactly as unresolvable as an id nothing recognises, so it
 * returns `undefined` rather than crashing a header that renders on every route.
 */
function decodeSegment(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

/**
 * `units` is the provider's live collection (`useWardFlow().units`) — the same parameter shape
 * `eligibleCandidatesAmong(movement, units, now, limit)` takes, never the frozen
 * `allUnits()`/`unitById()` fixture. A ward id not found in `units` returns `undefined`, exactly
 * as an unknown id would from `unitById` — this never falls back to searching the static fixture.
 */
export function wardPlaceFor(pathname: string, units: Unit[]): WardPlace | undefined {
  const wardMatch = WARD_ROUTE.exec(pathname);
  if (wardMatch) {
    const id = decodeSegment(wardMatch[1]);
    const unit = id === undefined ? undefined : units.find((candidate) => candidate.id === id);
    return unit === undefined ? undefined : { kind: "ward", name: unit.name };
  }

  const edMatch = ED_ROUTE.exec(pathname);
  if (edMatch) {
    const id = decodeSegment(edMatch[1]);
    const department = id === undefined ? undefined : edById(id);
    return department === undefined ? undefined : { kind: "ed", name: department.name };
  }

  const teamMatch = COMMUNITY_TEAM_ROUTE.exec(pathname);
  if (teamMatch) {
    const id = decodeSegment(teamMatch[1]);
    const team = id === undefined ? undefined : communityTeamById(id);
    return team === null || team === undefined ? undefined : { kind: "team", name: team.name };
  }

  return undefined;
}

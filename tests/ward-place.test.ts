import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardPlaceFor } from "@/components/ward-management/ward-place";
import { allEmergencyDepartments, allUnits } from "@/components/ward-management/ward-sites";

/**
 * `wardPlaceFor` — the place a route puts you in, or `undefined` where there is no place.
 *
 * Every name asserted below is READ from the same source module `wardPlaceFor` itself reads for
 * that kind (EDs and community teams: `ward-sites.ts`, `community-derivations.ts`), never typed
 * as a literal — a literal here would be a second copy of the name that could drift from the
 * first and the test would never notice. Ward units are the one exception, and deliberately so:
 * `wardPlaceFor` no longer reads `unitById` at all (whole-branch review I1) — it takes the
 * caller's live `units` as a parameter, the same shape `eligibleCandidatesAmong` takes. Most
 * tests below pass `allUnits()` as a stand-in for "the provider's live units, unchanged from the
 * fixture", so the names still come from that same source; the dedicated test further down
 * passes a unit list that DIFFERS from the fixture and asserts the passed-in name wins, which is
 * the property this parameterisation exists to prove.
 */
describe("wardPlaceFor", () => {
  it("found real units, departments and community teams to test against, or every assertion below is vacuous", () => {
    expect(allUnits().length).toBeGreaterThan(0);
    expect(allEmergencyDepartments().length).toBeGreaterThan(0);
    expect(COMMUNITY_TEAM_PAGES.length).toBeGreaterThan(0);
  });

  it("resolves a ward route to that unit's name, sourced from the passed-in live units", () => {
    const unit = allUnits()[0];
    expect(wardPlaceFor(`/mockups/ward-flow/ward/${unit.id}`, allUnits())).toEqual({
      kind: "ward",
      name: unit.name,
    });
  });

  it("resolves an ED route to that department's name, sourced from ward-sites.ts", () => {
    const department = allEmergencyDepartments()[0];
    expect(wardPlaceFor(`/mockups/ward-flow/ed/${department.id}`, allUnits())).toEqual({
      kind: "ed",
      name: department.name,
    });
  });

  it("resolves a community team route to that team's name, sourced from community-derivations.ts", () => {
    const team = COMMUNITY_TEAM_PAGES[0];
    expect(wardPlaceFor(`/mockups/ward-flow/community/${team.id}`, allUnits())).toEqual({
      kind: "team",
      name: team.name,
    });
  });

  it("returns undefined for a route that has no place at all", () => {
    // Seven of the ten approved prototypes have no place — a network-wide board and a patient's
    // own screen stand in for that whole class here.
    expect(wardPlaceFor("/mockups/ward-flow/search", allUnits())).toBeUndefined();
    expect(wardPlaceFor("/mockups/ward-flow/people/some-patient-id", allUnits())).toBeUndefined();
    expect(wardPlaceFor("/mockups/ward-flow", allUnits())).toBeUndefined();
  });

  it("returns undefined for an unresolvable ward id, never substituting a different ward", () => {
    // The same conservative-failure shape `person-screen.tsx` uses for an unknown patient: a
    // route naming an id nothing holds gets no place, not the first unit in the list.
    const place = wardPlaceFor("/mockups/ward-flow/ward/no-such-unit-id", allUnits());
    expect(place).toBeUndefined();
  });

  it("returns undefined for an unresolvable ED id, never substituting a different department", () => {
    const place = wardPlaceFor("/mockups/ward-flow/ed/no-such-ed-id", allUnits());
    expect(place).toBeUndefined();
  });

  it("returns undefined for an unresolvable community team id, never substituting a different team", () => {
    const place = wardPlaceFor("/mockups/ward-flow/community/no-such-team-id", allUnits());
    expect(place).toBeUndefined();
  });

  it("returns undefined for the community index route, which lists every team rather than naming one", () => {
    expect(wardPlaceFor("/mockups/ward-flow/community", allUnits())).toBeUndefined();
  });

  it("resolves a ward route from the PASSED-IN units, not the static ward-sites.ts fixture", () => {
    // The whole point of taking `units` as a parameter: a scenario can rename or alter a unit at
    // runtime (`ward-scenarios.ts`'s `structuredClone(allUnits())`), and the header must show
    // THAT name, not the frozen fixture's. Without this test, a caller could ignore the `units`
    // parameter entirely and fall back to `unitById` internally, and every other test above would
    // still pass — they all pass `allUnits()` unchanged, so a silently-ignored parameter is
    // indistinguishable from one actually read.
    const fixtureUnit = allUnits()[0];
    const renamedUnit: Unit = { ...fixtureUnit, name: "Renamed For Test — Not The Fixture Name" };
    const place = wardPlaceFor(`/mockups/ward-flow/ward/${fixtureUnit.id}`, [renamedUnit]);
    expect(place).toEqual({ kind: "ward", name: "Renamed For Test — Not The Fixture Name" });
    expect(place?.name).not.toBe(fixtureUnit.name);
  });
});

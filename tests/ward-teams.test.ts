// tests/ward-teams.test.ts
import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAMS, teamForRegion } from "../src/components/ward-management/ward-teams";
import { HOME_REGIONS } from "../src/components/ward-management/ward-model";
import { wardSites } from "../src/components/ward-management/ward-sites";

/**
 * Task 6. `COMMUNITY_TEAMS` names, per `HOME_REGIONS` entry, the synthetic community mental
 * health team a discharged patient is shown returning to. The system holds no real
 * region-to-service map, so every name here is invented and must read as invented — see
 * `ward-teams.ts`'s own doc comment for the full provenance.
 *
 * Every assertion below is a property over the WHOLE set (`HOME_REGIONS`, `COMMUNITY_TEAMS`, the
 * real site table), never a check against one hand-picked example. A test that searches a fixture
 * for AN example satisfying a property passes as soon as any example exists, even when a real
 * defect (a missing region, a name that collides with a real service) is sitting right next to
 * the example that happened to pass — so nothing here does that.
 */

/** Every real WA site/hospital name the network holds, derived from the module — never hard-coded,
 *  so a new site added to `ward-sites.ts` is covered automatically. */
const REAL_SITE_NAMES = wardSites.map((site) => site.name);

describe("ward-teams", () => {
  it("has a team for every member of HOME_REGIONS, iterating the real array", () => {
    for (const region of HOME_REGIONS) {
      expect(typeof COMMUNITY_TEAMS[region], `HOME_REGIONS entry "${region}" has no team`).toBe("string");
      expect(COMMUNITY_TEAMS[region]!.trim().length, `"${region}"'s team name must not be empty`).toBeGreaterThan(0);
    }
    // COMMUNITY_TEAMS carries exactly the regions HOME_REGIONS carries — no extra key nobody asked
    // for, and (together with the loop above) no missing one either.
    expect(Object.keys(COMMUNITY_TEAMS).sort()).toEqual([...HOME_REGIONS].sort());
  });

  it("returns null for an unrecognised region — never a guess, never a fallback team", () => {
    const notARealRegion = "Atlantis";
    expect(HOME_REGIONS as readonly string[], "the probe value must not collide with a real region").not.toContain(
      notARealRegion,
    );
    expect(teamForRegion(notARealRegion)).toBeNull();
    expect(teamForRegion("")).toBeNull();
    // Case/whitespace variants of a real region are not the same string and must not be guessed at.
    expect(teamForRegion(HOME_REGIONS[0].toUpperCase())).toBeNull();
    expect(teamForRegion(` ${HOME_REGIONS[0]} `)).toBeNull();
  });

  it("resolves teamForRegion to exactly the COMMUNITY_TEAMS entry for every recognised region", () => {
    for (const region of HOME_REGIONS) {
      expect(teamForRegion(region)).toBe(COMMUNITY_TEAMS[region]);
    }
  });

  it("names no team after a real WA hospital or service in the site table", () => {
    // Whole-set property: no team name, checked against the WHOLE real site table, may equal or
    // be contained within (or contain) a real site name. A partial-string check catches a synthetic
    // name built by simply appending a word to a real one.
    const teamNames = Object.values(COMMUNITY_TEAMS);
    expect(teamNames.length).toBeGreaterThan(0);
    for (const teamName of teamNames) {
      for (const realName of REAL_SITE_NAMES) {
        expect(teamName, `team "${teamName}" must not equal real site "${realName}"`).not.toBe(realName);
        expect(
          teamName.toLowerCase().includes(realName.toLowerCase()),
          `team "${teamName}" must not contain real site name "${realName}"`,
        ).toBe(false);
        expect(
          realName.toLowerCase().includes(teamName.toLowerCase()),
          `real site "${realName}" must not contain team "${teamName}"`,
        ).toBe(false);
      }
    }
  });

  it("gives every region a distinct team name", () => {
    const teamNames = Object.values(COMMUNITY_TEAMS);
    expect(new Set(teamNames).size).toBe(teamNames.length);
  });

  it("marks every team name as evidently synthetic, over the whole set", () => {
    // A visible marker so nobody mistakes an invented name for a real service on sight. Checked
    // over every entry, not one found example.
    for (const [region, teamName] of Object.entries(COMMUNITY_TEAMS)) {
      expect(teamName, `team for "${region}" ("${teamName}") carries no synthetic marker`).toMatch(/\(placeholder\)/i);
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  admissionsWithUnresolvableReferral,
  communityMembershipResolution,
  COMMUNITY_TEAM_PAGES,
} from "@/components/ward-management/community/community-derivations";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/*
 * ⚠️ THE FIXTURE COMES FROM THE SEEDED STATE, NOT FROM THE SEED MODULE'S ARRAYS. A first draft
 * imported `WARD_ADMISSIONS` and `WARD_REFERRALS`, neither of which exists — the module exports
 * `wardAdmissions` and the referrals are assembled by the reducer. It failed at import with
 * "Cannot read properties of undefined", which is the good failure: a guard whose fixture is
 * `undefined` walks nothing and would otherwise report a clean estate.
 */
const SEED = seedWardFlowState();
const WARD_ADMISSIONS = SEED.admissions;
const WARD_REFERRALS = SEED.referrals;

/**
 * 🔴 **"NOBODY IS IN A BED" AND "WE CANNOT TELL WHO IS IN A BED" MUST NOT READ ALIKE.**
 *
 * Ward Lead's ruling, 2026-09-05. Every community team page stated a measured absence over a join
 * that cannot resolve: `admissionBelongsToTeam` needs `Admission.referralId` to FIND a referral,
 * the reducer's only writer of that field sets it to `null`, and the seed manufactures the rest by
 * `AD-###` -> `RF-###` substitution against thirteen real referrals. **So three of the four lists
 * on a team page could never become non-empty, and each said so in the words of a measurement.**
 *
 * ⚠️ **THE LOAD-BEARING TEST IS THE SECOND ONE, NOT THE FIRST.** Proving the screen says "cannot
 * compute" today is easy and nearly worthless — a function that returned that unconditionally would
 * pass it. What has to hold is that **a fixture where the join DOES resolve reports members**, so
 * the sentence disappears the day somebody writes the link rather than becoming a false gap. A
 * hardcoded gap is the exact mirror of today's false answer and nothing would announce it.
 */

/** A referral the fixture really holds, and the one admission that joins to it for real. */
const REAL_JOIN = WARD_ADMISSIONS.find(
  (admission) =>
    admission.referralId !== null && WARD_REFERRALS.some((referral) => referral.id === admission.referralId),
);

function teamNamedBy(admission: Admission) {
  const referral = WARD_REFERRALS.find((candidate) => candidate.id === admission.referralId);
  const named = referral?.destinations.find((addressed) => addressed.destination.kind === "community_team");
  return named?.destination.kind === "community_team" ? named.destination.teamName : null;
}

/**
 * ⚠️ **EVERY TEAM A RESOLVING JOIN NAMES, NOT JUST THE FIRST ONE — AND THAT WAS A REAL DEFECT IN
 * THIS FILE (2026-09-05).** The tests below excluded `teamNamedBy(REAL_JOIN)`, a single name found
 * by taking the FIRST admission whose referral resolves. That was correct only while the fixture
 * held exactly one such join. When nine Midland demonstration referrals were added
 * (`MIDLAND_DEMONSTRATION_ROWS`, `ward-movements.ts`), `REAL_JOIN` happened to land on one of them,
 * Inner City Clinic fell into the "every other team" loop, and the suite reported that a team WITH
 * a member was stating a false gap. **The code was right and the premise had moved.**
 *
 * Computed rather than written down, so it cannot go stale the same way twice.
 */
const TEAMS_WITH_A_REAL_JOIN = new Set(
  WARD_ADMISSIONS.filter(
    (admission) =>
      admission.referralId !== null && WARD_REFERRALS.some((referral) => referral.id === admission.referralId),
  )
    .map((admission) => teamNamedBy(admission))
    .filter((name): name is string => name !== null),
);

describe("a team's empty list says which kind of empty it is", () => {
  /**
   * ⚠️ **THE PREMISE, PINNED BEFORE ANYTHING IS ASSERTED ABOUT IT.** Every assertion below depends
   * on the shipped fixture having exactly one real join and a large broken set. If that stopped
   * being true — somebody writes the link, or the seed changes — these tests would pass or fail for
   * reasons that have nothing to do with the code under test.
   */
  it("still has one admission that joins for real, and many that cannot", () => {
    expect(REAL_JOIN, "no admission in the fixture resolves to a referral any more").toBeDefined();
    expect(WARD_ADMISSIONS.length, "the admission fixture collapsed").toBeGreaterThan(20);
    expect(
      admissionsWithUnresolvableReferral(WARD_ADMISSIONS, WARD_REFERRALS).length,
      "no admission carries an unresolvable referralId, so the not-computable state cannot arise",
    ).toBeGreaterThan(5);
  });

  /**
   * ⚠️ **A NULL `referralId` IS NOT A BROKEN JOIN.** Somebody admitted with no referral at all was
   * never referred anywhere, so no team page is missing them. Counting them as unresolvable would
   * inflate the gap with people who are not in it, and the sentence the screen builds on this
   * number would overstate what it cannot see.
   */
  it("counts only a referralId that is set and resolves to nothing", () => {
    const unresolvable = admissionsWithUnresolvableReferral(WARD_ADMISSIONS, WARD_REFERRALS);
    for (const admission of unresolvable) {
      expect(admission.referralId, `${admission.id} has no referralId and was counted as a broken join`).not.toBeNull();
    }
    const withNoReferral = WARD_ADMISSIONS.filter((admission) => admission.referralId === null);
    for (const admission of withNoReferral) {
      expect(unresolvable, `${admission.id} has no referral at all and must not count as unresolvable`).not.toContain(
        admission,
      );
    }
  });

  /** The team whose member joins for real still shows members — the state must be per team. */
  it("reports members for the one team whose join resolves", () => {
    const teamName = teamNamedBy(REAL_JOIN!);
    expect(teamName, "the real join no longer names a community team").not.toBeNull();
    const team = COMMUNITY_TEAM_PAGES.find((candidate) => candidate.name === teamName);
    expect(team, `${String(teamName)} is not a team page`).toBeDefined();
    expect(communityMembershipResolution(WARD_ADMISSIONS, team!, WARD_REFERRALS).state).toBe("members");
  });

  /** Every other team is NOT COMPUTABLE, and must never be reported as a measured absence. */
  it("reports not-computable, never measured-empty, for teams whose join cannot resolve", () => {
    const others = COMMUNITY_TEAM_PAGES.filter((team) => !TEAMS_WITH_A_REAL_JOIN.has(team.name));
    expect(others.length, "there is only one team, so this proves nothing").toBeGreaterThan(10);
    // ⚠️ Floor the EXCLUSION too. An exclusion set that grew to cover every team would leave the
    // loop below walking nothing and reporting a clean estate — the failure this file's own
    // fixture note is about.
    expect(
      TEAMS_WITH_A_REAL_JOIN.size,
      "every team now has a resolving join, so the not-computable state cannot arise anywhere and " +
        "the loop below proves nothing",
    ).toBeLessThan(COMMUNITY_TEAM_PAGES.length / 2);
    expect(TEAMS_WITH_A_REAL_JOIN.size, "no team has a resolving join at all").toBeGreaterThan(0);
    for (const team of others) {
      const resolution = communityMembershipResolution(WARD_ADMISSIONS, team, WARD_REFERRALS);
      expect(
        resolution.state,
        `${team.name} reports "${resolution.state}" — a measured absence of people over a join that cannot resolve`,
      ).toBe("not-computable");
    }
  });

  /**
   * 🔴 **THE ONE THAT MATTERS: THE SENTENCE MUST DISAPPEAR WHEN THE LINK IS WRITTEN.** A function
   * hardcoded to "not-computable" passes every assertion above. This is the fixture where the join
   * works for everybody — and a page that still claimed a gap here would be asserting a false gap,
   * which is today's defect with its sign flipped and just as invisible.
   */
  it("reports a measured absence once every referralId resolves", () => {
    const repaired: Admission[] = WARD_ADMISSIONS.map((admission) => ({
      ...admission,
      referralId: WARD_REFERRALS.some((referral) => referral.id === admission.referralId) ? admission.referralId : null,
    }));
    expect(
      admissionsWithUnresolvableReferral(repaired, WARD_REFERRALS),
      "the repaired fixture still carries a broken join, so the check below proves nothing",
    ).toEqual([]);

    const other = COMMUNITY_TEAM_PAGES.find((team) => !TEAMS_WITH_A_REAL_JOIN.has(team.name));
    expect(other, "every team has a member, so there is no empty page to measure").toBeDefined();
    expect(communityMembershipResolution(repaired, other!, WARD_REFERRALS).state).toBe("measured-empty");
    // And a team that does have somebody still reports members rather than an absence.
    const realTeam = teamNamedBy(REAL_JOIN!);
    const team = COMMUNITY_TEAM_PAGES.find((candidate) => candidate.name === realTeam);
    expect(communityMembershipResolution(repaired, team!, WARD_REFERRALS).state).toBe("members");
  });
});

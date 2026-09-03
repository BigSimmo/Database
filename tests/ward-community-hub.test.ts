import { describe, expect, it } from "vitest";

import {
  admissionBelongsToTeam,
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityTeamById,
  communityTeamSlug,
  COMMUNITY_TEAM_PAGES,
  leavingDestinationLabel,
} from "@/components/ward-management/community/community-derivations";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { LEAVING_DESTINATIONS, type Admission } from "@/components/ward-management/ward-admissions";
import { S2015_CATCHMENT_ROWS, parseFollowUpClinicSet } from "@/components/ward-management/ward-catchment";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE COMMUNITY HUB'S DERIVATIONS, after the association rule changed.
 *
 * ⚠️ **THIS FILE REPLACES A REGION-BASED ONE, AND THE REPLACEMENT IS THE SUBJECT.** The previous
 * version asserted `admission.homeRegion === team.region` in a dozen shapes. The owner ruled on
 * 2026-08-31 that association comes from **a team named on the referral** and that home region is a
 * geographic guess, so every one of those assertions pinned the wrong rule. They are not adapted;
 * porting a test whose premise was reversed is how a guard comes to protect the defect.
 *
 * ⚠️ **THE MOST IMPORTANT TEST HERE IS THE ONE THAT PROVES REGION IS NOT READ.** Everything else
 * could pass on an implementation that consulted region as a tie-break or a fallback, because the
 * fixture's regions and its referral teams would usually agree. So two admissions are built with
 * the SAME home region and DIFFERENT referral teams, and a third with a region matching nothing.
 * Only an implementation that ignores region entirely can satisfy them.
 */

/** A fully-populated admission, minted rather than found, so states the seed cannot produce are
 *  still exercised. Typed as `Admission`, so a field added to the record fails to compile here
 *  rather than leaving this helper silently building a stale shape. */
function admission(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-TEST-01",
    unitId: "unit-under-test",
    specialling: false,
    referralId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: 0,
    arrivedAt: 0,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    ...overrides,
  };
}

/**
 * A referral naming one community team, built through the reducer's own write path rather than
 * hand-assembled, so the shape it holds is a shape the live system actually produces.
 *
 * `homeRegion` is passed deliberately and is DIFFERENT from the team in some callers below. That
 * mismatch is the point: a referral for somebody living in one place, addressed to a team named
 * explicitly, is precisely the case the old rule got wrong.
 */
function referralsNaming(teamNames: readonly string[], homeRegion: Referral["homeRegion"]): Referral[] {
  // ⚠️ ONE CHAIN, NOT ONE SEED PER REFERRAL, and this is a correctness requirement rather than
  // tidiness. Two calls to seedWardFlowState() each mint the SAME next referral id, so two
  // independently-seeded referrals collide, `referrals.find(id)` returns the first, and a person
  // referred to team B is reported as belonging to team A. That is a false result shaped exactly
  // like the defect this file exists to catch, and it is how a green suite hides one.
  let state = seedWardFlowState();
  const before = state.referrals.length;
  for (const teamName of teamNames) {
    state = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [{ kind: "community_team", teamName }],
      homeRegion,
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
    });
    expect(state.rejections, `the reducer refused a referral naming ${teamName}`).toEqual([]);
  }
  const created = state.referrals.slice(before);
  expect(created, "the reducer did not create one referral per requested team").toHaveLength(teamNames.length);
  // The whole reason this helper exists: distinct ids, asserted rather than assumed.
  expect(new Set(created.map((referral) => referral.id)).size, "two fixture referrals share an id").toBe(
    teamNames.length,
  );
  return created;
}

function referralNaming(teamName: string, homeRegion: Referral["homeRegion"]): Referral {
  return referralsNaming([teamName], homeRegion)[0];
}

const TEAM_A = COMMUNITY_TEAM_PAGES[0];
const TEAM_B = COMMUNITY_TEAM_PAGES[1];

describe("the community hub's team pages", () => {
  it("has a page for exactly the teams a referral can name, and no others", () => {
    // Derived from the same function intake offers, so the hub and the picker cannot drift. A
    // hand-written list here is the defect this asserts against.
    //
    // ⚠️ This alone is NOT a size guard: COMMUNITY_TEAM_PAGES is `.map()`-ed straight over
    // `communityTeamOptions()`, so a truncation inside that function moves both sides of this
    // comparison together and this line cannot go red for it (triage finding 9.7,
    // `.superpowers/sdd/ward-statistics-skeleton/wf-build-006-triage-report.md`). The size guard is
    // the next test, which is deliberately built without calling `communityTeamOptions()` at all.
    expect(COMMUNITY_TEAM_PAGES.map((team) => team.name)).toEqual([...communityTeamOptions()]);
  });

  it("has a page for every clinic the source catchment table names — a count read off the register, not off communityTeamOptions()", () => {
    // ⚠️ THIS IS THE FIX FOR FINDING 9.7 / 13.4: the source table can be trimmed from 65 clinics to
    // 3, or partially truncated to 43, and the test above stays green both times because it compares
    // COMMUNITY_TEAM_PAGES against communityTeamOptions() — the very function that was cut. This
    // test instead reads S2015_CATCHMENT_ROWS directly and folds punctuation itself, so a
    // truncation that happens *inside* communityTeamOptions() (a `.slice`, a dropped-singleton
    // filter, anything) cannot move both sides of the comparison together: the expected side never
    // calls that function.
    //
    // The normalisation below is a second, independent implementation of the same idea as the
    // production `communityTeamKey` (`referral-destination-options.ts`) — not a call to it, which
    // is unexported anyway. Writing it twice is deliberate: the point of this test is that its
    // expectation cannot be moved by editing `communityTeamOptions()`'s own body.
    function normalizeClinicName(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    const rawClinicNames = new Set<string>();
    for (const row of S2015_CATCHMENT_ROWS) {
      for (const clinic of parseFollowUpClinicSet(row.followUpClinicVerbatim)) {
        if (clinic.trim() !== "") rawClinicNames.add(clinic);
      }
    }
    const expectedKeys = new Set([...rawClinicNames].map(normalizeClinicName));

    const actualNames = COMMUNITY_TEAM_PAGES.map((team) => team.name);
    // The coverage IS the count, and the loop below only proves coverage — an empty
    // `actualNames` would iterate zero times and the loop alone would report nothing wrong. Pin
    // the exact count first (never a floor: a floor sees 65 collapse to 3, or to 43, and passes
    // either way), then let the loop check that the SAME 65 keys are the ones present.
    expect(actualNames.length, "COMMUNITY_TEAM_PAGES length no longer matches the register's own clinic count").toBe(
      expectedKeys.size,
    );

    const actualKeys = new Set(actualNames.map(normalizeClinicName));
    for (const key of expectedKeys) {
      // expect.soft, not a plain expect: a plain expect inside this loop would abort at the first
      // missing key, so a mutation that drops most-but-not-all of the register would only ever be
      // shown to have failed on ONE entry per run. Soft lets every iteration report.
      expect
        .soft(actualKeys.has(key), `no COMMUNITY_TEAM_PAGES entry matches the register's clinic "${key}"`)
        .toBe(true);
    }
  });

  it("derives every id from its own name, and no two teams share one", () => {
    for (const team of COMMUNITY_TEAM_PAGES) {
      expect(communityTeamSlug(team.name), `${team.name}'s id is not the slug of its name`).toBe(team.id);
      expect(team.id, `${team.name} produced an empty id`).not.toBe("");
    }
    // A collision would merge two teams' pages silently. These names come from an extracted source
    // document, so a pair differing only in punctuation is a real possibility rather than a
    // theoretical one.
    const ids = COMMUNITY_TEAM_PAGES.map((team) => team.id);
    expect(new Set(ids).size, "two community teams share a URL id, so one page shows the other's patients").toBe(
      ids.length,
    );
  });

  it("resolves an id exactly or not at all — never a fallback team", () => {
    expect(communityTeamById(TEAM_A.id)).toEqual(TEAM_A);
    expect(communityTeamById("no-such-team")).toBeNull();
    expect(communityTeamById(TEAM_A.id.toUpperCase())).toBeNull();
    expect(communityTeamById(` ${TEAM_A.id} `)).toBeNull();
    // The NAME is not the id. If this ever resolved, the slug function has become the identity and
    // ids carrying spaces or slashes would be reaching the router.
    expect(communityTeamById(TEAM_A.name)).toBeNull();
  });

  it("carries no region field at all, so no screen can fall back to one", () => {
    // Enforcement rather than tidiness. The rule the owner reversed is unavailable to a caller if
    // the fact it needs is not on the object.
    for (const team of COMMUNITY_TEAM_PAGES) {
      expect(Object.keys(team).sort()).toEqual(["id", "name"]);
    }
  });
});

describe("who belongs to a community team", () => {
  it("belongs when a referral names the team", () => {
    const referral = referralNaming(TEAM_A.name, "Perth Metropolitan");
    const person = admission({ referralId: referral.id });
    expect(admissionBelongsToTeam(person, TEAM_A, [referral])).toBe(true);
    expect(admissionBelongsToTeam(person, TEAM_B, [referral])).toBe(false);
  });

  it("⚠️ IGNORES HOME REGION ENTIRELY — the guard on the rule the owner reversed", () => {
    // Same region, different teams. Under the old rule these two were on the SAME page and the
    // referral was never consulted; under the owner's rule they are on different pages and the
    // region is never consulted. No implementation can satisfy both.
    const [toA, toB] = referralsNaming([TEAM_A.name, TEAM_B.name], "Perth Metropolitan");
    const personA = admission({ id: "AD-A", referralId: toA.id, homeRegion: "Perth Metropolitan" });
    const personB = admission({ id: "AD-B", referralId: toB.id, homeRegion: "Perth Metropolitan" });

    expect(admissionBelongsToTeam(personA, TEAM_A, [toA, toB])).toBe(true);
    expect(admissionBelongsToTeam(personB, TEAM_A, [toA, toB])).toBe(false);
    expect(admissionBelongsToTeam(personB, TEAM_B, [toA, toB])).toBe(true);

    // And the converse: a region that matches nothing changes no answer at all.
    const farAway = admission({ id: "AD-C", referralId: toA.id, homeRegion: "Kimberley" });
    expect(admissionBelongsToTeam(farAway, TEAM_A, [toA, toB])).toBe(true);
    const noRegion = admission({ id: "AD-D", referralId: toA.id, homeRegion: null });
    expect(admissionBelongsToTeam(noRegion, TEAM_A, [toA, toB])).toBe(true);
  });

  it("belongs to nobody without a referral, or with a referral that named no community team", () => {
    const referral = referralNaming(TEAM_A.name, "Perth Metropolitan");
    // No referral at all — every admission created by PULL_PATIENT during a session.
    expect(admissionBelongsToTeam(admission({ referralId: null }), TEAM_A, [referral])).toBe(false);
    // A referral id that resolves to nothing is not a guess: it is a non-member.
    expect(admissionBelongsToTeam(admission({ referralId: "REF-MISSING" }), TEAM_A, [referral])).toBe(false);
    // A real seeded referral that asked for a bed rather than a team.
    const wardOnly = seedWardFlowState().referrals.find((candidate) =>
      candidate.destinations.every((addressed) => addressed.destination.kind !== "community_team"),
    );
    expect(wardOnly, "the seed holds no referral without a community destination").toBeDefined();
    expect(admissionBelongsToTeam(admission({ referralId: wardOnly!.id }), TEAM_A, [wardOnly!])).toBe(false);
  });

  it("still belongs when the community destination was declined or cancelled", () => {
    // FD-24: a decline locks nobody out. Filtering on state here would remove from a team's page
    // exactly the referrals that went wrong, which is the population this hub exists to surface.
    const referral = referralNaming(TEAM_A.name, "Perth Metropolitan");
    const rewritten: Referral = {
      ...referral,
      destinations: referral.destinations.map((addressed) => ({ ...addressed, state: "declined" as const })),
    };
    const person = admission({ referralId: rewritten.id });
    expect(admissionBelongsToTeam(person, TEAM_A, [rewritten])).toBe(true);
  });
});

describe("the cohort no team can see", () => {
  it("is exactly those on no team's page", () => {
    const toA = referralNaming(TEAM_A.name, "Perth Metropolitan");
    const member = admission({ id: "AD-IN", referralId: toA.id });
    const orphan = admission({ id: "AD-OUT", referralId: null });
    const unattributable = admissionsWithNoCommunityTeam([member, orphan], [toA]);

    expect(unattributable.map((entry) => entry.id)).toEqual(["AD-OUT"]);
    // Non-vacuity: the member really is on a page, so the exclusion above means something.
    expect(admissionBelongsToTeam(member, TEAM_A, [toA])).toBe(true);
  });

  it("⚠️ is the MAJORITY of the shipped seed, which the screen must say out loud", () => {
    // Under the region rule this was 0 of 267 and the screen could fairly say nobody is missing yet.
    // Under the owner's rule it is nearly everyone, because naming a community team is rare and
    // deliberate. This is pinned rather than left as prose: if it ever quietly became small, the
    // screen's central claim — that a team page is not a picture of an area — would have gone stale.
    const { admissions, referrals } = seedWardFlowState();
    const unattributable = admissionsWithNoCommunityTeam(admissions, referrals);
    expect(admissions.length).toBeGreaterThan(0);
    expect(unattributable.length).toBeGreaterThan(admissions.length / 2);
  });
});

describe("the lists a team's page renders", () => {
  it("counts nobody twice and nobody the referral did not name", () => {
    const [toA, toB] = referralsNaming([TEAM_A.name, TEAM_B.name], "Perth Metropolitan");
    const inBed = admission({ id: "AD-BED", referralId: toA.id, state: "occupied" });
    const goneHome = admission({
      id: "AD-HOME",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR,
    });
    const elsewhere = admission({ id: "AD-OTHER", referralId: toB.id, state: "occupied" });

    const lists = communityHubLists([inBed, goneHome, elsewhere], TEAM_A, [toA, toB]);
    expect(lists.currentlyAdmitted.map((entry) => entry.id)).toEqual(["AD-BED"]);
    expect(lists.dischargedIntoTheArea.map((entry) => entry.id)).toEqual(["AD-HOME"]);
    // The other team's patient appears in none of the four lists.
    for (const list of Object.values(lists)) {
      expect(list.map((entry: Admission) => entry.id)).not.toContain("AD-OTHER");
    }
  });

  it("keeps expectedBack a strict subset of currentlyAdmitted", () => {
    const toA = referralNaming(TEAM_A.name, "Perth Metropolitan");
    const dated = admission({ id: "AD-DATED", referralId: toA.id, expectedDischargeAt: NOW_ANCHOR + 4320 });
    const undated = admission({ id: "AD-UNDATED", referralId: toA.id });
    const lists = communityHubLists([dated, undated], TEAM_A, [toA]);
    expect(lists.expectedBack.map((entry) => entry.id)).toEqual(["AD-DATED"]);
    for (const entry of lists.expectedBack) {
      expect(lists.currentlyAdmitted).toContain(entry);
    }
  });

  it("separates a discharge into the community from every other departure", () => {
    const toA = referralNaming(TEAM_A.name, "Perth Metropolitan");
    const departures = LEAVING_DESTINATIONS.map((destination, index) =>
      admission({
        id: `AD-LEFT-${index}`,
        referralId: toA.id,
        state: "departed",
        leavingDestination: destination.id,
        leftAt: NOW_ANCHOR,
      }),
    );
    const lists = communityHubLists(departures, TEAM_A, [toA]);
    // Exactly one entry of the vocabulary — whatever its size — states that somebody went back into
    // the community. No count is written here: this comment said "the five" until 2026-09-01, when
    // the owner added three destinations and it went stale with nothing going red. The assertion
    // below reads `LEAVING_DESTINATIONS` and always did.
    expect(lists.dischargedIntoTheArea).toHaveLength(1);
    expect(lists.dischargedIntoTheArea[0].leavingDestination).toBe("discharged-to-the-community");
    // And nobody is dropped: every other departure is carried, so a short list is visibly a
    // consequence of the record rather than of what the module chose to look at.
    expect(lists.otherDepartures).toHaveLength(LEAVING_DESTINATIONS.length - 1);
  });

  it("labels every departure destination from the vocabulary, and never substitutes a word", () => {
    for (const destination of LEAVING_DESTINATIONS) {
      expect(leavingDestinationLabel(destination.id)).toBe(destination.label);
    }
    expect(leavingDestinationLabel(null)).toBeNull();
  });
});

/**
 * ⚠️ **THE SHIPPED SEED, WHICH UNTIL 2026-09-01 COULD NOT PUT ANYBODY ON ANY OF THE 65 PAGES.**
 *
 * Every test above builds its own referrals and admissions, and every one of them passed while the
 * real hub was empty everywhere — because `admissionBelongsToTeam` was correct and the seed could
 * never satisfy it. Each of the four seed producers in `ward-admissions-seed.ts` MANUFACTURED
 * `referralId` from the admission's own id by string substitution, so the overlap with the real
 * referral ids was zero and the lookup failed for every admission against every team. **A test
 * asserting that a team page renders correctly when empty was the only assertion that could pass,
 * and it would have passed with the whole derivation deleted.**
 *
 * So this block asserts the seed itself. `docs/ward-flow/fields-with-no-producer-2026-09-01.md`
 * (final addendum) is the account.
 */
describe("the shipped seed reaches a team page", () => {
  it("puts AD-LEFT-01 on Inner City Clinic's page, and on no other team's", () => {
    const { admissions, referrals } = seedWardFlowState();

    const withPeople = COMMUNITY_TEAM_PAGES.filter(
      (team) => admissions.filter((entry) => admissionBelongsToTeam(entry, team, referrals)).length > 0,
    );
    expect(
      withPeople.map((team) => team.name),
      "the seeded community link is gone. AD-LEFT-01's referralId must be the id of a real " +
        "referral naming a community team (RF-010 today) — NOT a value composed from its own id, " +
        "which is what every other seeded admission carries and what joins to nothing.",
    ).toEqual(["Inner City Clinic"]);

    const lists = communityHubLists(admissions, withPeople[0], referrals);
    // ⚠️ The DISCHARGED list, which is the one the hub exists for and the one whose empty state was
    // unfalsifiable. AD-LEFT-01 is also the seed's only admission carrying a follow-up record, so
    // reaching it here is what finally gives `Admission.followUp` a reader as well as a producer.
    expect(lists.dischargedIntoTheArea.map((entry) => entry.id)).toEqual(["AD-LEFT-01"]);
    expect(lists.dischargedIntoTheArea[0].followUp?.state).toBe("not_arranged");
    expect(lists.currentlyAdmitted).toHaveLength(0);
    expect(lists.otherDepartures).toHaveLength(0);
  });

  it("⚠️ the pair can carry a duration — the referral was raised BEFORE the admission arrived", () => {
    /*
     * ⚠️ **THIS IS THE ASSERTION THAT SEPARATES A LINK FROM A NAMING COINCIDENCE, AND IT IS THE ONE
     * A CHEAP FIX WOULD FAIL.** `52ad01dda` populated nine team pages by naming referrals after the
     * ids the admissions already manufactured. The pages rendered; every pair it made put the
     * person in the bed before the referral existed, so not one could carry a duration. It arrived
     * as the repair to a known problem, which is exactly why it was believed.
     *
     * The same property is measured over the whole seed by `referralToBedJoin`
     * (`tests/ward-statistics-derivations.test.ts`, and the rendered figure in
     * `tests/ward-statistics.dom.test.tsx`). It is asserted HERE as well, on this specific pair,
     * because the hub is where a wrong pair would be read by a person rather than counted.
     */
    const { admissions, referrals } = seedWardFlowState();
    const admitted = admissions.find((entry) => entry.id === "AD-LEFT-01");
    expect(admitted, "AD-LEFT-01 is the seed's only joined admission and it is gone").toBeDefined();

    const referral = referrals.find((candidate) => candidate.id === admitted!.referralId);
    expect(referral, `${admitted!.referralId} does not resolve to a seeded referral`).toBeDefined();
    expect(referral!.destinations.map((addressing) => addressing.destination.kind)).toEqual(["community_team"]);

    expect(admitted!.arrivedAt, "a joined admission with no arrival can carry no duration").not.toBeNull();
    expect(
      admitted!.arrivedAt! > referral!.raisedAt,
      "AD-LEFT-01 is in the bed before the referral it names was raised. That is not a link, it is " +
        "the 52ad01dda shape: either lengthen the referral's lead over the arrival or stop " +
        "claiming the two records are the two ends of one journey.",
    ).toBe(true);
    // And the pull too, not only the arrival — the bed was committed after the referral existed.
    expect(admitted!.pulledAt! > referral!.raisedAt).toBe(true);
  });
});

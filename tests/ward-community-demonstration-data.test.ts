/**
 * The coupling between the Midland demonstration referrals (`ward-movements.ts`,
 * `MIDLAND_DEMONSTRATION_ROWS`) and the admissions they name (`ward-admissions-seed.ts`).
 *
 * ⚠️ **THIS FILE IS THE ONLY PLACE THAT COUPLING CAN LIVE.** The two fixtures cannot import one
 * another — `tests/ward-flow-single-source.test.ts` allows exactly four files under `src/` to read
 * the admissions seed and `ward-movements.ts` is not one of them — so every instant in the
 * demonstration rows is a literal written against a value in the other file, and nothing in `src/`
 * can notice when one of them moves.
 *
 * ⚠️ **AND THE PROPERTY IT GUARDS IS THE ONE `52ad01dda` GOT WRONG.** That commit populated nine
 * community team pages by pointing referrals at admissions, and every pair it produced had the
 * person in the bed BEFORE the referral existed — matched records that could not carry a duration,
 * shipped as a repair and backed out at `fa616d1c9`. The demonstration rows are the same manoeuvre
 * done deliberately; what makes them different is entirely in the timing, and timing is exactly what
 * decays silently. **If somebody later lengthens one of these stays, or shortens a lead, this file
 * is what says so.**
 *
 * ⚠️ **EVERY COUNT BELOW IS FLOORED ON THE POPULATION WALKED, NEVER ON THE VIOLATIONS FOUND.** A
 * loop over an empty array finds no violations and passes, which is how a guard over a fixture
 * quietly stops guarding it the day the fixture is renamed.
 */
import { describe, expect, it } from "vitest";

import { MIDLAND_DEMONSTRATION_ROWS } from "@/components/ward-management/ward-movements";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { RECENTLY_DECIDED_DISPLAY_LIMIT, recentlyDecidedReferrals } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  COMMUNITY_TEAM_PAGES,
  admissionBelongsToTeam,
  communityHubLists,
} from "@/components/ward-management/community/community-derivations";

const TEAM_NAME = "Midland";

/** The row count is asserted rather than derived from the array, so shrinking the fixture to one
 *  row cannot silently shrink every loop below with it. */
const EXPECTED_ROW_COUNT = 9;

describe("the Midland demonstration referrals", () => {
  it("is the size this file was written against", () => {
    expect(
      MIDLAND_DEMONSTRATION_ROWS.length,
      "the demonstration fixture changed size. That is allowed — but update this number deliberately, " +
        "because every assertion below walks this array and a shorter one proves proportionally less.",
    ).toBe(EXPECTED_ROW_COUNT);
  });

  it("names an admission that exists, and the admission points back", () => {
    const { admissions } = seedWardFlowState();
    expect(admissions.length, "no admissions to join against").toBeGreaterThan(0);

    let checked = 0;
    for (const row of MIDLAND_DEMONSTRATION_ROWS) {
      const admission = admissions.find((candidate) => candidate.id === row.admissionId);
      expect(admission, `${row.id} names ${row.admissionId}, which is not in the admissions seed`).toBeDefined();
      expect(
        admission!.referralId,
        `${row.admissionId} no longer carries ${row.id}. These referrals exist ONLY because the ` +
          "admissions seed already manufactures that id — if the admission's id scheme changed, " +
          "this referral now joins to nobody and Midland's page has quietly emptied.",
      ).toBe(row.id);
      checked += 1;
    }
    expect(checked).toBe(EXPECTED_ROW_COUNT);
  });

  it("records each admission's own bed pull, and the recorded value is still true", () => {
    const { admissions } = seedWardFlowState();

    let checked = 0;
    for (const row of MIDLAND_DEMONSTRATION_ROWS) {
      const admission = admissions.find((candidate) => candidate.id === row.admissionId)!;
      expect(admission.pulledAt, `${row.admissionId} has no bed pull to compare against`).not.toBeNull();
      const actualDaysBefore = (NOW_ANCHOR - admission.pulledAt!) / MINUTES_PER_DAY;
      expect(
        Number(actualDaysBefore.toFixed(2)),
        `${row.id} records ${row.admissionId}'s bed as pulled ${row.bedPulledDaysBeforeAnchor} days ` +
          "before the anchor and the admissions seed now says otherwise. That column is context for " +
          "a reader; it is wrong now, so fix it rather than deleting it.",
      ).toBe(row.bedPulledDaysBeforeAnchor);
      checked += 1;
    }
    expect(checked).toBe(EXPECTED_ROW_COUNT);
  });

  it("⚠️ was raised, and answered, before the bed it is joined to was ever pulled", () => {
    const { admissions, referrals } = seedWardFlowState();

    let checked = 0;
    for (const row of MIDLAND_DEMONSTRATION_ROWS) {
      const admission = admissions.find((candidate) => candidate.id === row.admissionId)!;
      const referral = referrals.find((candidate) => candidate.id === row.id);
      expect(referral, `${row.id} is not in the seeded referrals`).toBeDefined();

      const addressed = referral!.destinations.find(
        (entry) => entry.destination.kind === "community_team" && entry.destination.teamName === TEAM_NAME,
      );
      expect(addressed, `${row.id} no longer addresses ${TEAM_NAME}`).toBeDefined();
      expect(
        addressed!.state,
        `${row.id} is not accepted. A queued community-only referral sits at the ` +
          "top of the coordinator's bed-matching queue — that is what fa616d1c9 backed out.",
      ).toBe("accepted");
      expect(addressed!.decidedAt, `${row.id} is accepted with no instant, so it can date nothing`).toBeDefined();

      // The whole point, in three comparisons: raised, then answered, then the bed.
      expect(
        referral!.raisedAt < admission.pulledAt!,
        `${row.id} was raised after ${row.admissionId}'s bed was pulled. That is the 52ad01dda shape.`,
      ).toBe(true);
      expect(
        addressed!.decidedAt! < admission.pulledAt!,
        `${TEAM_NAME} accepted ${row.id} after ${row.admissionId}'s bed was pulled, so this person was ` +
          "not already with the team when they were admitted — which is the only thing the hub's " +
          "flagged section claims.",
      ).toBe(true);
      expect(
        admission.arrivedAt !== null && addressed!.decidedAt! < admission.arrivedAt,
        `${row.id} cannot carry an acceptance-to-admission duration for ${row.admissionId}`,
      ).toBe(true);
      checked += 1;
    }
    expect(checked).toBe(EXPECTED_ROW_COUNT);
  });

  it("⚠️ does not evict a real referral from the coordinator's decided board", () => {
    /*
     * ⚠️ **THIS IS THE `fa616d1c9` FAILURE ONE LIST ALONG, AND IT HAPPENED.** `recentlyDecidedReferrals`
     * sorts decided referrals newest-first and keeps `RECENTLY_DECIDED_DISPLAY_LIMIT` of them. The
     * demonstration rows are decided, so three of them accepted more recently than `RF-010` pushed
     * `RF-010` — the seed's one real community link, and the only referral any admission points at —
     * off the coordinator's board entirely. **The count on that board still looked right.** Only a
     * test naming the missing id caught it.
     *
     * Pinned as a MEMBERSHIP question rather than a length, for exactly that reason: a length passes
     * while the wrong ten rows are shown.
     */
    const { referrals } = seedWardFlowState();
    const shown = recentlyDecidedReferrals(referrals).map((referral) => referral.id);
    expect(shown.length, "nothing is on the decided board at all").toBeGreaterThan(0);
    expect(shown.length).toBeLessThanOrEqual(RECENTLY_DECIDED_DISPLAY_LIMIT);

    const demonstrationIds = new Set(MIDLAND_DEMONSTRATION_ROWS.map((row) => row.id));
    const realDecided = referrals
      .filter((referral) => !demonstrationIds.has(referral.id))
      .filter((referral) => referral.destinations.some((entry) => entry.state !== "queued"))
      .map((referral) => referral.id);
    expect(realDecided.length, "no real decided referral to be evicted from").toBeGreaterThan(0);

    const evicted = realDecided.filter((id) => !shown.includes(id));
    expect(
      evicted,
      "a real decided referral has been pushed off the coordinator's board by demonstration data. " +
        "Every demonstration row must be accepted LONGER ago than every real one — raise its " +
        "acceptedDaysBeforeAnchor rather than raising the display limit.",
    ).toEqual([]);
  });

  it("puts all nine on Midland's page and on nobody else's", () => {
    const { admissions, referrals } = seedWardFlowState();
    const midland = COMMUNITY_TEAM_PAGES.find((team) => team.name === TEAM_NAME);
    expect(midland, `there is no community team called ${TEAM_NAME} any more`).toBeDefined();

    const lists = communityHubLists(admissions, midland!, referrals);
    expect(lists.currentlyAdmitted.map((entry) => entry.id).sort()).toEqual(
      MIDLAND_DEMONSTRATION_ROWS.map((row) => row.admissionId).sort(),
    );

    // The exclusion half, which is what makes the line above mean something: every other team's
    // page must be untouched by this block.
    const otherTeamsWithDemonstrationMembers = COMMUNITY_TEAM_PAGES.filter(
      (team) =>
        team.name !== TEAM_NAME &&
        MIDLAND_DEMONSTRATION_ROWS.some((row) => {
          const admission = admissions.find((candidate) => candidate.id === row.admissionId)!;
          return admissionBelongsToTeam(admission, team, referrals);
        }),
    );
    expect(otherTeamsWithDemonstrationMembers.map((team) => team.name)).toEqual([]);
    expect(COMMUNITY_TEAM_PAGES.length, "no team pages to have excluded").toBeGreaterThan(1);
  });
});

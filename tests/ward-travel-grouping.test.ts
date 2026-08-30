// tests/ward-travel-grouping.test.ts
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { Admission } from "../src/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "../src/components/ward-management/ward-admissions-seed";
import {
  NOT_RECORDED_LABEL,
  OUT_OF_AREA_BANDS,
  TRAVEL_BAND_LABELS,
  TRAVEL_BANDS,
  travelBand,
  unitTravelBand,
} from "../src/components/ward-management/ward-distance";
import { referralEligibility } from "../src/components/ward-management/ward-eligibility";
import {
  HOME_REGIONS,
  type HomeRegion,
  type Referral,
  type Sex,
  type Unit,
  type WardReferralDestination,
} from "../src/components/ward-management/ward-model";
import {
  candidateAccepts,
  groupCandidatesByTravelBand,
  outOfAreaLedger,
  referralCandidates,
  travelBandGroupCounts,
  type OutOfAreaEntry,
  type ReferralCandidate,
} from "../src/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits } from "../src/components/ward-management/ward-sites";

/**
 * Phase 8 Task 3. The same boundary `tests/ward-travel-bands.test.ts` sets for itself applies here
 * and for the same reason: every value in `SYNTHETIC_TRAVEL_BANDS` is invented, sits beside REAL
 * hospital names, and nobody has measured one. So NO test in this file may assert a specific band
 * for a specific place, or name a region and a hospital together in an expectation. Where a test
 * needs a concrete pair with a particular shape it SEARCHES the fixture for one and fails loudly
 * by name if none exists — so on the day the placeholders are replaced with checked values this
 * file either stays green or fails honestly, and never quietly pins a placeholder into a claim.
 *
 * What it guards is the phase's defining hazard: grouping quietly becoming ranking. That never
 * arrives as a decision — it arrives as a small helpful sort inside a group, or a group promoted
 * because it is the useful one. Each property below is therefore a test rather than a review
 * argument.
 */

const NOW = 10 * 60 + 42;

/** Ward referrals throughout: travel bands are computed for bed placement, which only a ward
 *  referral has. Flat overrides, routed into `destination` here, for the same reason as
 *  `ward-referral-matching.test.ts` -- the call sites' meaning must not move with the shape. */
type ReferralOverrides = Partial<Omit<Referral, "destinations">> & Partial<Omit<WardReferralDestination, "kind">>;

function referral(overrides: ReferralOverrides = {}): Referral {
  const { sex, secureBedNeeded, involuntaryBedNeeded, ...rest } = overrides;
  return {
    id: "RF-TEST",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: sex ?? "Female",
          secureBedNeeded: secureBedNeeded ?? false,
          involuntaryBedNeeded: involuntaryBedNeeded ?? false,
        },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...rest,
  };
}

/**
 * Runs the bed gates for a referral built above.
 *
 * Exists because `referralEligibility` now takes the WARD DESTINATION as well as the referral —
 * the criteria live on the arm, and a referral may be addressed to several places. This unwraps
 * the one ward destination these fixtures carry and THROWS if there is not one, so a fixture that
 * stopped being a ward referral fails loudly here rather than quietly skipping the gates.
 */
/** `referralCandidates` for a fixture referral, unwrapping its ward destination the same way
 *  `verdictFor` does — and throwing for the same reason. */
function candidatesFor(subject: Referral, units: Unit[], now: number) {
  const ward = subject.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  if (!ward || ward.destination.kind !== "psychiatric_ward") {
    throw new Error(`${subject.id} has no psychiatric ward destination, so it has no bed candidates`);
  }
  return referralCandidates(subject, ward.destination, units, now);
}

function verdictFor(subject: Referral, unitArg: Unit, now: number) {
  const ward = subject.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  if (!ward || ward.destination.kind !== "psychiatric_ward") {
    throw new Error(`${subject.id} has no psychiatric ward destination, so it has no bed gates to run`);
  }
  return referralEligibility(subject, ward.destination, unitArg, now);
}

/** The grouping's own key order, derived from `TRAVEL_BANDS` so no test hand-writes a parallel
 *  list of band names — the defect that once left two screens disagreeing about what bands exist. */
const GROUP_ORDER: string[] = [...TRAVEL_BANDS, "not_recorded"];

/**
 * Written out as a literal ON PURPOSE, and the one number in this file that is not derived.
 * `GROUP_ORDER` above comes from `TRAVEL_BANDS`, and so does the grouping's own order, so
 * `expect(groups).toHaveLength(GROUP_ORDER.length)` compares a list against itself and cannot
 * fail — add a band and both sides move together. Pinning the count independently means adding or
 * removing a band is a decision somebody makes here, in a test, rather than a silent consequence.
 * It counts groups on a screen; it is not a clinical, legal or measured figure of any kind.
 */
const EXPECTED_GROUP_COUNT = 5;

function flatten(groups: { candidates: ReferralCandidate[] }[]): ReferralCandidate[] {
  return groups.flatMap((group) => group.candidates);
}

/** The bands the fixture records across the whole network for one home region, looked up through
 *  `unitTravelBand` — NEVER through `groupCandidatesByTravelBand`. A fixture search that ran on the
 *  output of the function under test would be steered by the very defect it is searching for: the
 *  "omit empty groups" mutation removed the empty group, so a search for one found nothing and the
 *  structural assertion below never ran. This reads the bands independently, so the mutation lands
 *  on the assertion instead. */
function bandsAcrossNetwork(homeRegion: HomeRegion): (string | undefined)[] {
  const subject = referral({ homeRegion });
  return allUnits().map((candidate) => unitTravelBand(subject, candidate));
}

/** Searches the network for a home region whose recorded bands have the shape a test needs, so no
 *  test names a region or a hospital. Returns null rather than falling back to one. */
function regionWhere(predicate: (bands: (string | undefined)[]) => boolean): HomeRegion | null {
  return HOME_REGIONS.find((homeRegion) => predicate(bandsAcrossNetwork(homeRegion))) ?? null;
}

describe("grouping candidates by travel band", () => {
  it("returns exactly five groups, in TRAVEL_BANDS order followed by not_recorded", () => {
    const subject = referral();
    const groups = groupCandidatesByTravelBand(subject, candidatesFor(subject, allUnits(), NOW));
    expect(groups).toHaveLength(EXPECTED_GROUP_COUNT);
    expect(groups.map((group) => String(group.band))).toEqual(GROUP_ORDER);
  });

  it("renders a band with no candidates as an empty group rather than omitting it", () => {
    // "There is nothing available within an hour" is an answer a coordinator came for, so an
    // omitted group is worse than an empty one. Searched, never named: a region is used here only
    // if the fixture actually leaves one of its bands empty.
    const emptyBandOf = (bands: (string | undefined)[]) => TRAVEL_BANDS.find((band) => !bands.includes(band));
    const homeRegion = regionWhere((bands) => emptyBandOf(bands) !== undefined);
    expect(
      homeRegion,
      "no home region in the fixture leaves a band empty — this test can no longer prove empty groups survive",
    ).not.toBeNull();
    const emptyBand = emptyBandOf(bandsAcrossNetwork(homeRegion!))!;

    const subject = referral({ homeRegion: homeRegion! });
    const groups = groupCandidatesByTravelBand(subject, candidatesFor(subject, allUnits(), NOW));
    expect(groups).toHaveLength(EXPECTED_GROUP_COUNT);
    expect(groups.map((group) => String(group.band))).toEqual(GROUP_ORDER);
    // The band no unit in the whole network sits in still gets a group, and that group is empty.
    expect(groups.find((group) => group.band === emptyBand)?.candidates).toEqual([]);
  });

  it("loses nothing: every candidate appears in exactly one group, including an unbanded one", () => {
    // Run against a region the fixture records for SOME sites and not others, so the not_recorded
    // group is genuinely populated — the case a "drop what I could not classify" implementation
    // passes every other test in this file while failing this one.
    const homeRegion = regionWhere(
      (bands) => bands.some((band) => band === undefined) && bands.some((band) => band !== undefined),
    );
    expect(
      homeRegion,
      "no home region has both banded and unbanded units — this test can no longer prove unbanded candidates survive",
    ).not.toBeNull();

    const subject = referral({ homeRegion: homeRegion! });
    const candidates = candidatesFor(subject, allUnits(), NOW);
    const grouped = flatten(groupCandidatesByTravelBand(subject, candidates));

    expect(grouped).toHaveLength(candidates.length);
    // Identity, not deep equality: a group holding a copy would satisfy a value comparison while
    // breaking the "pure rearrangement of a list someone else computed" claim.
    expect(new Set(grouped).size).toBe(candidates.length);
    for (const candidate of candidates) expect(grouped).toContain(candidate);
  });

  it("reorders nothing inside a group: units sharing a band keep the order they arrived in", () => {
    const units = allUnits();
    let found: { homeRegion: HomeRegion; expected: string[] } | null = null;
    for (const homeRegion of HOME_REGIONS) {
      const subject = referral({ homeRegion });
      const groups = groupCandidatesByTravelBand(subject, candidatesFor(subject, units, NOW));
      const populated = groups.find((group) => group.candidates.length >= 2);
      if (!populated) continue;
      const members = new Set(populated.candidates.map((candidate) => candidate.unit.id));
      found = { homeRegion, expected: units.filter((entry) => members.has(entry.id)).map((entry) => entry.id) };
      break;
    }
    expect(
      found,
      "no band anywhere in the fixture holds two units — order inside a group is untestable",
    ).not.toBeNull();

    const subject = referral({ homeRegion: found!.homeRegion });
    const groups = groupCandidatesByTravelBand(subject, candidatesFor(subject, units, NOW));
    const populated = groups.find((group) => group.candidates.length >= 2)!;
    expect(populated.candidates.length).toBeGreaterThanOrEqual(2);
    // The site table's own order — what `allUnits()` returns, and the order the morning page uses.
    // A sort inside a group, by name or by eligibility or by anything at all, breaks this.
    expect(populated.candidates.map((candidate) => candidate.unit.id)).toEqual(found!.expected);
  });

  it("labels no group best, nearest or recommended", () => {
    const comparative =
      /furthest|most remote|hardest|nearest|closest|best|worst|recommend|optimal|preferred|suggested/i;
    const subject = referral();
    const groups = groupCandidatesByTravelBand(subject, candidatesFor(subject, allUnits(), NOW));
    const headings = groups.map((group) =>
      group.band === "not_recorded" ? NOT_RECORDED_LABEL : TRAVEL_BAND_LABELS[group.band],
    );
    expect(headings).toHaveLength(EXPECTED_GROUP_COUNT);
    for (const heading of headings) expect(heading).not.toMatch(comparative);
    for (const group of groups) expect(String(group.band)).not.toMatch(comparative);
  });

  it("groups the WHOLE network, not a list someone already narrowed", () => {
    // The caveat the signature cannot enforce. `groupCandidatesByTravelBand` will happily group a
    // truncated list, so "nothing is lost" is a property relative to its own input and not a
    // guarantee that every unit reached it. This is the separate claim: the full candidate list —
    // every unit in the network — is what actually gets grouped.
    const units = allUnits();
    expect(
      units.length,
      "the network shrank — re-check that this floor still means 'every unit', not 'one site's worth'",
    ).toBeGreaterThanOrEqual(10);
    const subject = referral();
    const candidates = candidatesFor(subject, units, NOW);
    expect(candidates).toHaveLength(units.length);
    expect(flatten(groupCandidatesByTravelBand(subject, candidates))).toHaveLength(units.length);
  });
});

describe("distance groups the list and never gates it", () => {
  const SEXES: Sex[] = ["Female", "Male"];

  /** Every referral shape worth sweeping against a unit: one per sex, matched to that unit's own
   *  cohort and security so the sweep exercises beds that really can accept somebody. */
  function shapesFor(candidate: Unit): Partial<Referral>[] {
    return SEXES.map((sex) => ({
      sex,
      ageBand: candidate.cohort,
      secureBedNeeded: candidate.security === "Secure",
    }));
  }

  const gateFingerprint = (verdict: ReturnType<typeof referralEligibility>) =>
    verdict.gates.map((entry) => `${entry.gate}:${entry.pass}`);

  /** Every synthetic site code in the network, so the sweep below varies `originSiteCode` over
   *  real values rather than one invented string. */
  const SITE_CODES = [...new Set(allUnits().map((candidate) => candidate.siteCode))];

  it("decides eligibility identically wherever the person lives, and wherever they were referred from", () => {
    // The honest formulation of "distance never gates", and the one a distance gate cannot survive
    // under ANY name. `homeRegion` is the only input a band is computed from — a band is
    // `f(homeRegion, siteCode)` — so a gate that reads distance necessarily makes the verdict for
    // one bed vary as the home region varies. Nothing else in `referralEligibility` reads
    // `homeRegion` at all, so this must hold exactly.
    //
    // Written this way after a mutation survived the earlier version: that test SEARCHED for an
    // out-of-area bed that accepts a referral, so under a distance gate the search simply found a
    // different pair the mutant happened to allow, and stayed green. A search run against the
    // function under test is steered by the defect it is looking for.
    let outOfAreaPairsSwept = 0;
    let outOfAreaPairsAccepted = 0;
    let pairsRefused = 0;

    for (const candidate of allUnits()) {
      for (const shape of shapesFor(candidate)) {
        // `originSiteCode` is swept alongside `homeRegion` because measuring from the hospital
        // the referral came from, rather than from where the person lives, is THE founding defect
        // of this phase: it called a city bed close for someone driven into a city emergency
        // department from a long way away. It is also the single most likely wrong implementation
        // anybody would write here, and until this sweep existed nothing caught it. Pairing the
        // two rather than crossing them keeps the sweep O(regions) while still varying each.
        const swept = HOME_REGIONS.map((homeRegion, index) => {
          const originSiteCode = SITE_CODES[index % SITE_CODES.length];
          const subject = referral({ ...shape, homeRegion, originSiteCode });
          return {
            homeRegion,
            originSiteCode,
            band: unitTravelBand(subject, candidate),
            verdict: verdictFor(subject, candidate, NOW),
          };
        });
        const reference = swept[0];
        for (const entry of swept) {
          expect(
            entry.verdict.eligible,
            `${candidate.id} changed its verdict for a person from ${entry.homeRegion} referred via ${entry.originSiteCode} — something is reading distance`,
          ).toBe(reference.verdict.eligible);
          expect(gateFingerprint(entry.verdict)).toEqual(gateFingerprint(reference.verdict));
        }
        for (const entry of swept) {
          if (!entry.verdict.eligible) pairsRefused += 1;
          if (entry.band === undefined || !OUT_OF_AREA_BANDS.includes(entry.band)) continue;
          outOfAreaPairsSwept += 1;
          if (entry.verdict.eligible) outOfAreaPairsAccepted += 1;
        }
      }
    }

    // AN INVARIANCE TEST NEEDS A COMPANION THAT PINS AN ABSOLUTE IN A CASE WHERE THE ANSWERS
    // SHOULD DIFFER. Invariance proves nothing when everything collapses to one value, and it
    // collapses in BOTH directions: a network that refuses everybody is perfectly invariant, and
    // so is a network that accepts everybody — the second is worse, because it makes the two
    // out-of-area floors below MORE satisfied rather than less. The three floors here are that
    // companion. Each stands for a distinct property, and none of them is arithmetic about the
    // others:
    //
    //   1. the sweep really reached out-of-area pairs, so "distance does not gate" has a subject;
    //   2. at least one of those pairs ACCEPTS, so uniform refusal cannot masquerade as
    //      invariance — and so the claim a coordinator reads is real: a bed three hours away that
    //      accepts this referral still says so, and still carries its Accept control;
    //   3. at least one pair REFUSES, so uniform acceptance cannot either. Without this the gates
    //      could all have been reduced to `true` and every assertion above would still pass.
    //
    // Floors rather than absolute counts, deliberately: an exact number here would be brittle
    // against any fixture change and would start pinning the placeholder band table, which no test
    // in this file may do. The floor is the weakest statement that still rules the collapse out.
    expect(outOfAreaPairsSwept, "the sweep covered no out-of-area pair — invariance proves nothing").toBeGreaterThan(0);
    expect(
      outOfAreaPairsAccepted,
      "no out-of-area bed in the fixture accepts anybody — 'distance does not gate' is unproven",
    ).toBeGreaterThan(0);
    expect(
      pairsRefused,
      "every unit accepted every referral — uniform acceptance is perfectly invariant, so the sweep above proves nothing",
    ).toBeGreaterThan(0);
  });

  it("rests on a fixture that really does vary the band across home regions", () => {
    // The invariance proof is only as strong as the spread of bands the fixture exposes. If every
    // pair returned the same band — or none at all — a band-reading gate would not vary with home
    // region either, and the sweep above would stay green while proving nothing. These are the two
    // structural facts that proof depends on, asserted here rather than assumed. No site or region
    // is named: both are computed across the whole fixture, so replacing the placeholder values
    // cannot turn this into a pinned claim about a particular hospital.
    const bandsAt = (siteCode: string) =>
      new Set(HOME_REGIONS.map((homeRegion) => travelBand(homeRegion, siteCode) ?? "not_recorded"));
    const siteCodes = [...new Set(allUnits().map((candidate) => candidate.siteCode))];

    // One site alone separates most of the partition, so a gate reading the band AT THAT SITE must
    // vary across home regions and cannot hide inside a single value.
    const widest = Math.max(...siteCodes.map((code) => bandsAt(code).size));
    expect(
      widest,
      "no site exposes four distinct band values across the home regions — the invariance sweep can no longer prove a band-reading gate would vary",
    ).toBeGreaterThanOrEqual(4);

    // Between them the sites expose every band and the unrecorded case, so a gate keyed on any one
    // band value is still visible to the sweep rather than only the values that happen to occur.
    const exposed = new Set(siteCodes.flatMap((code) => [...bandsAt(code)]));
    for (const band of TRAVEL_BANDS) {
      expect(
        [...exposed],
        `no site records ${band} for any home region — a gate keyed on it would be invisible`,
      ).toContain(band);
    }
    expect([...exposed], "no pair is unrecorded — the not-recorded case is invisible to the sweep").toContain(
      "not_recorded",
    );
  });

  it("names no eligibility gate after travel, distance or a band", () => {
    const distanceish = /travel|distance|band|proximity|remote|near|far|kilometre|kilometer|\bkm\b/i;
    const seen = new Set<string>();
    for (const candidate of allUnits()) {
      for (const homeRegion of HOME_REGIONS) {
        for (const gate of verdictFor(referral({ homeRegion }), candidate, NOW).gates) seen.add(gate.gate);
      }
    }
    expect(seen.size, "no gates were collected — this sweep proves nothing").toBeGreaterThan(0);
    for (const gate of seen) expect(gate).not.toMatch(distanceish);
  });
});

describe("the out-of-area ledger", () => {
  /**
   * Phase 8 Task 2R. These tests read `Admission`, not `Referral`.
   *
   * **Nothing is seeded.** No `Admission` fixture exists anywhere in the repository yet — the seed
   * is owned by the workstream that built the record and is in flight on its own branch — so every
   * admission below is built in the test that needs it. That is stated rather than worked around:
   * this suite proves the derivation, and NOT that the demonstration data a screen will render
   * holds any of these shapes. When that fixture lands it must carry, at minimum, an occupied
   * out-of-area admission, one whose band the table does not record, and one that has LEFT an
   * out-of-area bed. Until then the seeded demonstration is owed, not delivered.
   *
   * The boundary this whole file sets still applies: no test here names a region and a hospital
   * together in an expectation. Where a concrete out-of-area or unrecorded pair is needed it is
   * SEARCHED for in the fixture and the test fails loudly by name if none exists, so replacing the
   * placeholders with checked values either leaves this file green or fails it honestly.
   */
  const units = allUnits();
  // Asserted rather than assumed. A bare `!` here would turn a renamed or removed unit into a
  // confusing `undefined` failure deep inside an unrelated expectation, several tests later.
  const acceptingUnit = units.find((candidate) => candidate.id === "fsh-adult-secure");
  it("has the accepting unit these ledger tests are built on", () => {
    expect(
      acceptingUnit,
      "fsh-adult-secure is gone from the network — every ledger test below is built on it",
    ).toBeDefined();
  });

  /** A whole `Admission`, every field written out, so a field added to the record makes these
   *  tests fail to compile rather than silently defaulting. Occupied and arrived by default —
   *  the state this ledger is about — with each test overriding only what it is testing. */
  function admission(overrides: Partial<Admission> = {}): Admission {
    return {
      id: "AD-TEST",
      unitId: "fsh-adult-secure",
      referralId: "RF-TEST",
      awayAtEmergencyDepartmentSince: null,
      sex: "Female",
      homeRegion: "Perth Metropolitan",
      // `null` on purpose: nothing in this file reads or asserts on the tentative diagnosis, so a
      // value here would be a fact nobody uses. The field is present because `Admission` declares
      // it non-optional — a record where nobody wrote one down is present-and-empty.
      tentativeDiagnosis: null,
      state: "occupied",
      pulledAt: NOW - 90,
      arrivedAt: NOW - 30,
      expectedDischargeAt: null,
      dischargeDateMoves: 0,
      dischargeDateSetAt: null,
      dischargeDateSetBy: null,
      // Nobody has decided a discharge for anyone in this ledger. `null` is the ordinary state of
      // both fields and must never read as a refusal or as a discharge that will not happen; it
      // means the decision has not been taken. This suite is about people occupying beds now, so
      // that is the right default. A test needing a decided departure overrides both together.
      dischargeConfirmedAt: null,
      dischargeConfirmedBy: null,
      blockReason: null,
      leavingDestination: null,
      leftAt: null,
      ...overrides,
    };
  }

  /** A home region the fixture records as out of area for `siteCode`, searched rather than named.
   *  Returns `undefined` when none exists, which every caller asserts against by name. */
  function outOfAreaRegionFor(siteCode: string): HomeRegion | undefined {
    return HOME_REGIONS.find((region) => {
      const band = travelBand(region, siteCode);
      return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
    });
  }

  /** A home region the fixture records NO band for at `siteCode`. */
  function unbandedRegionFor(siteCode: string): HomeRegion | undefined {
    return HOME_REGIONS.find((region) => travelBand(region, siteCode) === undefined);
  }

  /** A home region the fixture records a band for at `siteCode` that is NOT out of area. */
  function inAreaRegionFor(siteCode: string): HomeRegion | undefined {
    return HOME_REGIONS.find((region) => {
      const band = travelBand(region, siteCode);
      return band !== undefined && !OUT_OF_AREA_BANDS.includes(band);
    });
  }

  it("counts an occupied admission whose band is a member of OUT_OF_AREA_BANDS", () => {
    const homeRegion = outOfAreaRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is out of area for this site — the ledger is untestable").toBeDefined();

    const subject = admission({ id: "AD-FAR", homeRegion: homeRegion! });
    const { entries, notBanded } = outOfAreaLedger([subject], units, NOW);
    expect(entries).toHaveLength(1);
    expect(notBanded).toBe(0);
    expect(entries[0].admission).toBe(subject);
    expect(entries[0].unit.id).toBe(subject.unitId);
    expect(OUT_OF_AREA_BANDS).toContain(entries[0].band);
    // The band is looked up from the ADMISSION's home region and the unit's own site, never
    // stored on the record and never guessed.
    // Task 17 (2026-08-30) made `homeRegion` nullable for an ED-arrival admission. Every admission
    // this test reaches is seeded and always carries one, so the promise is asserted rather than
    // narrowed past with a `!`.
    expect(subject.homeRegion, "a seeded admission must carry a home region").not.toBeNull();
    expect(entries[0].band).toBe(travelBand(subject.homeRegion!, entries[0].unit.siteCode));
  });

  /**
   * THE POINT OF TASK 2R. The version this replaced read accepted referrals, and a referral never
   * stops being accepted — so somebody discharged weeks ago stayed on the ledger forever with
   * their elapsed time still climbing. `Admission` closes, and this is the test that says so.
   *
   * The two admissions differ in ONE field pair (`state`/`leftAt`) and are otherwise identical,
   * including the arrival the clock runs from — so nothing but the departure can explain the
   * difference in the result. Deleting the `state === "left"` guard in `outOfAreaLedger` makes
   * this fail; nothing else in that function would exclude a departed admission, because a
   * departed admission still carries the `arrivedAt` it arrived on.
   */
  it("excludes an admission that has LEFT, however far from home and however long it stayed", () => {
    const homeRegion = outOfAreaRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is out of area for this site — the exit case is untestable").toBeDefined();

    const stillHere = admission({ id: "AD-STILL-HERE", homeRegion: homeRegion! });
    const hasLeft = admission({
      ...stillHere,
      id: "AD-LEFT",
      state: "left",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW - 5,
    });

    // The control: identical but for the departure, and it does count.
    expect(outOfAreaLedger([stillHere], units, NOW).entries).toHaveLength(1);
    // Somebody who has left is not in a bed far from home. Neither number, not one of them.
    expect(outOfAreaLedger([hasLeft], units, NOW)).toEqual({ entries: [], notBanded: 0 });
    // And a departure is not rescued by a very long stay, which is exactly the entry the broken
    // version accumulated.
    const longGone = admission({ ...hasLeft, id: "AD-LONG-GONE", arrivedAt: NOW - 100000, leftAt: NOW - 90000 });
    expect(outOfAreaLedger([longGone], units, NOW)).toEqual({ entries: [], notBanded: 0 });
  });

  it("does not count an admission that has LEFT as notBanded either, whatever its band", () => {
    // The departure check comes FIRST, so a departed admission is never even banded. Folding it
    // in after the band lookup would put this one in `notBanded`, which is a figure about beds
    // somebody is currently in.
    const homeRegion = unbandedRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is unrecorded for this site — this case is untestable").toBeDefined();

    const hasLeft = admission({
      id: "AD-LEFT-UNBANDED",
      homeRegion: homeRegion!,
      state: "left",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW - 5,
    });
    expect(outOfAreaLedger([hasLeft], units, NOW)).toEqual({ entries: [], notBanded: 0 });
  });

  it("counts an admission whose band the fixture does not record as notBanded, never as out of area", () => {
    const homeRegion = unbandedRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is unrecorded for this site — the unbanded case is untestable").toBeDefined();

    const subject = admission({ id: "AD-UNBANDED", homeRegion: homeRegion! });
    expect(outOfAreaLedger([subject], units, NOW)).toEqual({ entries: [], notBanded: 1 });
  });

  it("puts an occupied admission whose band is recorded and in area in neither number", () => {
    const homeRegion = inAreaRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is in area for this site — the in-area case is untestable").toBeDefined();

    const subject = admission({ id: "AD-IN-AREA", homeRegion: homeRegion! });
    expect(outOfAreaLedger([subject], units, NOW)).toEqual({ entries: [], notBanded: 0 });
  });

  it("puts an admission with no arrival in neither number, whether it is waitlisted or pulled", () => {
    const homeRegion = outOfAreaRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is out of area for this site — the no-arrival case is untestable").toBeDefined();

    // Waitlisted: no bed at all, so no pull either.
    const waitlisted = admission({
      id: "AD-WAITLISTED",
      homeRegion: homeRegion!,
      state: "waitlisted",
      pulledAt: null,
      arrivedAt: null,
    });
    // Pulled: the bed IS gone, but nobody is in it yet — so this ledger, which measures time away
    // from home, has nothing to measure. `bedIsOccupied` answers the other question and counts it.
    const pulled = admission({ id: "AD-PULLED", homeRegion: homeRegion!, state: "pulled", arrivedAt: null });

    expect(outOfAreaLedger([waitlisted, pulled], units, NOW)).toEqual({ entries: [], notBanded: 0 });
  });

  /**
   * The occupancy check is an ALLOWLIST, not a `state !== "left"` denylist, and this is the test
   * that tells the two apart. A departure test alone cannot: both forms exclude a departure.
   *
   * A waitlisted admission holds no bed, so it can never be somebody placed in a bed far from
   * home, whatever timestamps the record happens to carry. Under a denylist this counts — and the
   * same hole is the structural one: a fifth `AdmissionState` added later would fall through a
   * denylist as OCCUPIED BY DEFAULT and appear on a ledger a coordinator reads as fact. An
   * unrecognised state must be excluded, not counted. That fifth state cannot be constructed here
   * without widening the union, so this test pins the case that CAN be constructed, and the
   * derivation reuses `bedIsOccupied` so both are decided in one place.
   *
   * The arrival is deliberately present and finite. Without it the arrival check would exclude the
   * record on its own and this test would pass against the denylist too — proving nothing.
   */
  it("does not count a waitlisted admission even when it carries an arrival time", () => {
    const homeRegion = outOfAreaRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is out of area for this site — the allowlist case is untestable").toBeDefined();

    const arrivedAt = NOW - 30;
    // The control: identical but for the state, and it DOES count — so the exclusion below is
    // attributable to the state alone and not to a band, a unit or a missing arrival.
    const occupied = admission({ id: "AD-ALLOWLIST-CONTROL", homeRegion: homeRegion!, arrivedAt });
    expect(outOfAreaLedger([occupied], units, NOW).entries).toHaveLength(1);

    const waitlistedWithArrival = admission({
      id: "AD-WAITLISTED-ARRIVED",
      homeRegion: homeRegion!,
      state: "waitlisted",
      pulledAt: null,
      arrivedAt,
    });
    expect(outOfAreaLedger([waitlistedWithArrival], units, NOW)).toEqual({ entries: [], notBanded: 0 });
  });

  it("skips an admission whose unit no longer resolves rather than banding it against a guess", () => {
    const subject = admission({ id: "AD-NOUNIT", unitId: "a-unit-that-does-not-exist" });
    // Not an entry, and NOT notBanded: nothing was looked up, so nothing failed to be found.
    expect(outOfAreaLedger([subject], units, NOW)).toEqual({ entries: [], notBanded: 0 });
  });

  it("runs the clock from arrivedAt, never from pulledAt", () => {
    const homeRegion = outOfAreaRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is out of area for this site — the clock case is untestable").toBeDefined();

    const arrivedAt = NOW - 20;
    const pulledAt = NOW - 45;
    const subject = admission({ id: "AD-CLOCK", homeRegion: homeRegion!, pulledAt, arrivedAt });

    const { entries } = outOfAreaLedger([subject], units, NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0].sinceArrival).toBe(NOW - arrivedAt);
    // Two different facts. The bed has been gone since the pull; this ledger measures how long
    // somebody has been away from home, which starts when they get there. The pull-to-arrival gap
    // is a real figure and deliberately not surfaced here.
    expect(entries[0].sinceArrival).not.toBe(NOW - pulledAt);
  });

  it("reports two counts with no shared denominator to read a proportion from", () => {
    // `notBanded` and `entries.length` count two different things. A `total`, `of`, `all` or
    // `percentage` key appearing here is how a later screen comes to present them as parts of one
    // whole, which neither this derivation nor any screen may do.
    //
    // This matters more than it looks. The band table records only some home regions and only some
    // sites within those, so in real seeded data the unclassified count dwarfs the out-of-area one
    // — about twelve to one when it was measured. A key that let the two be divided would turn
    // that honest gap into an apparent shortfall, which is exactly the reading that must be
    // impossible rather than merely discouraged.
    const homeRegion = outOfAreaRegionFor(acceptingUnit!.siteCode);
    expect(homeRegion, "no home region is out of area for this site").toBeDefined();
    const ledger = outOfAreaLedger([admission({ homeRegion: homeRegion! })], units, NOW);
    expect(Object.keys(ledger).sort()).toEqual(["entries", "notBanded"]);
  });

  it("preserves the order the admissions were given in and never ranks them", () => {
    // Three arrivals, given in middle/oldest/newest order, spread across two out-of-area sites
    // with different bands — so a comparator on band and a comparator on unit both have something
    // to move, not just a comparator on time. Everything is located by SEARCH, so a fixture change
    // surfaces as a loud skip-reason rather than silently making the test vacuous.
    const outOfAreaAt = (homeRegion: HomeRegion) =>
      units.filter((candidate) => {
        const band = travelBand(homeRegion, candidate.siteCode);
        return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
      });

    let placement: { homeRegion: HomeRegion; first: Unit; second: Unit } | null = null;
    for (const homeRegion of HOME_REGIONS) {
      const far = outOfAreaAt(homeRegion);
      const first = far[0];
      const second = far.find(
        (candidate) =>
          first &&
          candidate.siteCode !== first.siteCode &&
          travelBand(homeRegion, candidate.siteCode) !== travelBand(homeRegion, first.siteCode),
      );
      if (first && second) {
        placement = { homeRegion, first, second };
        break;
      }
    }
    expect(
      placement,
      "no home region has two out-of-area units at different sites with different bands — comparator detection is untestable",
    ).not.toBeNull();
    const { homeRegion, first, second } = placement!;

    const arrival = (id: string, unit: Unit, arrivedAt: number): Admission =>
      admission({ id, homeRegion, unitId: unit.id, pulledAt: arrivedAt - 5, arrivedAt });

    // Middle, oldest, newest — an order that is not sorted by arrival in either direction.
    const given = [
      arrival("AD-ORDER-MIDDLE", first, NOW - 120),
      arrival("AD-ORDER-OLDEST", second, NOW - 300),
      arrival("AD-ORDER-NEWEST", first, NOW - 10),
    ];
    const givenIds = given.map((entry) => entry.id);

    const { entries } = outOfAreaLedger(given, units, NOW);
    expect(entries).toHaveLength(3);
    // This is a ledger of people, not a queue. Nothing here ranks, prioritises or shortlists.
    expect(entries.map((entry) => entry.admission.id)).toEqual(givenIds);

    // The fixture must be able to DETECT each comparator somebody might helpfully add. Asserting
    // that the given order differs from every plausible sorted order is what makes the assertion
    // above a guard rather than a coincidence.
    const orderedBy = (compare: (a: OutOfAreaEntry, b: OutOfAreaEntry) => number) =>
      [...entries].sort(compare).map((entry) => entry.admission.id);
    const detectable: [string, string[]][] = [
      ["most recently arrived first", orderedBy((a, b) => b.admission.arrivedAt! - a.admission.arrivedAt!)],
      ["longest here first", orderedBy((a, b) => a.admission.arrivedAt! - b.admission.arrivedAt!)],
      ["shortest time here first", orderedBy((a, b) => a.sinceArrival - b.sinceArrival)],
      ["by band", orderedBy((a, b) => a.band.localeCompare(b.band))],
      ["by unit", orderedBy((a, b) => a.unit.id.localeCompare(b.unit.id))],
    ];
    for (const [name, ordering] of detectable) {
      expect(ordering, `a "${name}" comparator would be a no-op against this fixture — it proves nothing`).not.toEqual(
        givenIds,
      );
    }
  });
});

describe("only ward-distance.ts reads the travel-band fixture", () => {
  // A band looked up in two places is a band that can disagree with itself between two screens —
  // the exact defect Phase 5 shipped and caught only by screenshot. Scoped to `src/` deliberately:
  // `tests/ward-travel-bands.test.ts` imports the fixture legitimately, to assert its structure,
  // and a contract test that goes red on correct code is one whoever meets it will weaken.
  //
  // COMMENTS ARE STRIPPED FIRST, and that is the whole design of this guard rather than a detail.
  // The obvious implementation — match `import ... ;` in the raw source — is defeated by a comment,
  // because the match is non-greedy and stops at the FIRST semicolon it meets. A semicolon inside a
  // comment in the middle of an import truncates the "statement" before the module specifier:
  //
  //     import {
  //       // see ward-travel-bands.ts; the fixture lives there
  //       SYNTHETIC_TRAVEL_BANDS,
  //     } from "@/components/ward-management/ward-travel-bands";
  //
  // ...yields a "statement" ending at that semicolon, which contains neither the
  // specifier nor the imported name, so the import passes unnoticed. A guard a comment can defeat
  // is not a guard. Stripping first also lets this check the WHOLE remaining source rather than
  // only import statements, which closes the second half of the rule — the fixture must not be
  // indexed inline either — that a statement-only check could never have seen. `ward-movements.ts`
  // and `ward-model.ts` name the fixture in prose explaining why they do NOT store a band; those
  // are comments, so they disappear before anything is matched.
  const SRC_ROOT = resolve(process.cwd(), "src");
  const ALLOWED = join("components", "ward-management", "ward-distance.ts");
  const FIXTURE = join("components", "ward-management", "ward-travel-bands.ts");

  /** Removes line and block comments while respecting string and template literals, so a module
   *  specifier or a message that happens to contain `//` is never mistaken for a comment. */
  function withoutComments(source: string): string {
    return scanSource(source).text;
  }

  // Where a `/` may legitimately begin a REGEX LITERAL rather than a division. Bounded to the
  // trailing few characters so this stays linear over a large file.
  const REGEX_MAY_FOLLOW =
    /(^|[([{,;:=!&|?+\-*%~^<>])\s*$|\b(return|typeof|case|in|of|delete|void|instanceof|new|do|else|yield|await)\s+$/;

  function scanSource(source: string): { text: string; balanced: boolean } {
    let out = "";
    let index = 0;
    let inCharacterClass = false;
    let mode: "code" | "line" | "block" | "'" | '"' | "`" | "regex" = "code";
    while (index < source.length) {
      const character = source[index];
      const pair = source.slice(index, index + 2);
      if (mode === "code") {
        if (pair === "//") {
          mode = "line";
          index += 2;
          continue;
        }
        if (pair === "/*") {
          mode = "block";
          index += 2;
          continue;
        }
        // A regex literal is TRACKED, never stripped: its text stays in the output, so this can
        // only ever scan more than it did, never less. What matters is that a quote character
        // inside one no longer opens a string that was never there. `answer-claim-marks.ts`
        // contains a regex holding a backtick, which opened TEMPLATE mode — and a template
        // legitimately spans newlines, so the newline resynchronisation below could not recover it
        // and the rest of the file went unscanned.
        if (character === "/" && REGEX_MAY_FOLLOW.test(out.slice(-12))) {
          mode = "regex";
          inCharacterClass = false;
          out += character;
          index += 1;
          continue;
        }
        if (character === "'" || character === '"' || character === "`") mode = character;
        out += character;
        index += 1;
        continue;
      }
      if (mode === "regex") {
        if (character === "\\") {
          out += source.slice(index, index + 2);
          index += 2;
          continue;
        }
        // A regex literal cannot span a raw newline either, so this resynchronises for the same
        // reason the string branch below does.
        if (character === "\n") {
          mode = "code";
          out += "\n";
          index += 1;
          continue;
        }
        if (character === "[") inCharacterClass = true;
        else if (character === "]") inCharacterClass = false;
        else if (character === "/" && !inCharacterClass) mode = "code";
        out += character;
        index += 1;
        continue;
      }
      if (mode === "line") {
        if (character === "\n") {
          mode = "code";
          out += "\n";
        }
        index += 1;
        continue;
      }
      if (mode === "block") {
        if (pair === "*/") {
          mode = "code";
          index += 2;
        } else {
          index += 1;
        }
        continue;
      }
      // Inside a quoted string. The escape is handled FIRST so a line continuation (a backslash
      // followed by a newline) is consumed as one unit rather than tripping the resynchronisation
      // below.
      if (character === "\\") {
        out += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      // RESYNCHRONISATION, added fix round 5. A single- or double-quoted literal cannot contain a
      // raw newline — that is a syntax error in JavaScript — so meeting one means the scanner
      // opened a string that was never really there and has lost its place. The case that does
      // this is a REGEX LITERAL containing a quote character, which this scanner does not track:
      // without the line below, one such regex flips the scanner into string mode permanently and
      // every line after it goes unscanned. Measured over every file under `src`, that silently
      // blinded nine files, one of them for its last 65 lines. Template literals legitimately span
      // newlines, so they are excluded here and are covered by the balance check instead.
      if (character === "\n" && mode !== "`") {
        mode = "code";
        out += "\n";
        index += 1;
        continue;
      }
      if (character === mode) mode = "code";
      out += character;
      index += 1;
    }
    // A scan that ends inside a string, a template or a block comment has lost its place, and a
    // guard that has lost its place must say so rather than report clean over a partial read.
    return { text: out, balanced: mode === "code" || mode === "line" };
  }

  it("strips a comment that would otherwise hide an import", () => {
    // The stripper is what this contract rests on, so it is tested rather than trusted — and with
    // the exact shape that defeats the naive version, plus the string literal that must survive.
    // The exact shape that defeats the naive `import ... ;` match: the semicolon inside the
    // comment ends the "statement" before the specifier is ever reached.
    const awkward = [
      "import {",
      "  // note; see below",
      "  SYNTHETIC_TRAVEL_BANDS,",
      '} from "x/ward-travel-bands";',
    ].join("\n");
    expect(awkward.match(/import\s+[\s\S]*?;/)?.[0]).not.toContain("ward-travel-bands");

    const hidden = withoutComments(awkward);
    expect(hidden).toContain("SYNTHETIC_TRAVEL_BANDS");
    expect(hidden).toContain("ward-travel-bands");
    expect(hidden).not.toContain("note");

    // A string literal that merely looks like a comment must survive untouched.
    expect(withoutComments('const url = "https://example.test/a"; // trailing')).toBe(
      'const url = "https://example.test/a"; ',
    );
    expect(withoutComments("const a = 1; /* block */ const b = 2;")).toBe("const a = 1;  const b = 2;");

    // DIRECTLY PINS THE RESYNCHRONISATION. Regex tracking now handles every case in the real
    // fixture, so nothing under `src` requires the resynchronisation any more and a mutation
    // removing it reddened nothing — it was live code with no test. It is the net for a quote the
    // regex heuristic misjudges, so rather than delete it or leave it unproven it is pinned here
    // on a synthetic input: a scanner that has opened a string which was never there must recover
    // at the newline instead of treating every following comment as string content.
    const strayQuote = ['const broken = "oops', "// hidden; comment", '} from "x/ward-travel-bands";'].join("\n");
    expect(
      withoutComments(strayQuote),
      "the scanner did not recover, so a later comment was read as code",
    ).not.toContain("hidden");
    expect(scanSource(strayQuote).balanced, "the scanner ended a recoverable file out of step").toBe(true);

    // PINS THE BALANCE DETECTOR ITSELF. The sweep that applies it can only fail if some file in
    // its scope actually desynchronises, and no file in the graph does today — so without this
    // line the detector would be an unfalsifiable check dressed as a guard. An unterminated
    // template cannot be recovered by the newline rule, because a template legitimately spans
    // newlines, so it is the honest case for "the scanner finished out of step".
    expect(
      scanSource("const a = `unterminated").balanced,
      "the balance check cannot detect an unbalanced scan, so the sweep using it proves nothing",
    ).toBe(false);
  });

  it("no module under src reads ward-travel-bands.ts except ward-distance.ts", () => {
    const files = readdirSync(SRC_ROOT, { recursive: true, encoding: "utf8" }).filter((file) => /\.tsx?$/.test(file));
    expect(files.length, "the src sweep collected no files — this contract would prove nothing").toBeGreaterThan(50);

    // The scanner must not silently under-read. If it finishes a file believing it is still inside
    // a string, a template or a block comment, it has lost its place and everything after that
    // point went unscanned — so this guard would report clean over a partial read. That is not a
    // theoretical worry: before the resynchronisation in `scanSource`, a regex literal containing
    // a quote character blinded nine files under `src`, one of them for its last 65 lines.
    const desynchronised = files.filter((file) => !scanSource(readFileSync(join(SRC_ROOT, file), "utf8")).balanced);
    expect(
      desynchronised,
      `the comment scanner lost its place in ${desynchronised.length} file(s): ${desynchronised.join(", ")}`,
    ).toEqual([]);

    const readers = files
      // The fixture declaring its own contents is not a module reading it. Excluded by exact path
      // rather than by a pattern, so this can never quietly widen to excuse a second file.
      .filter((file) => file !== FIXTURE)
      .filter((file) =>
        /ward-travel-bands|SYNTHETIC_TRAVEL_BANDS/.test(withoutComments(readFileSync(join(SRC_ROOT, file), "utf8"))),
      );

    // The detector must be shown to detect. `ward-distance.ts` really does read the fixture, so an
    // empty result here would mean the sweep was broken, not that the contract holds.
    expect(readers).toContain(ALLOWED);
    expect(readers, `modules reading the travel-band fixture: ${readers.join(", ")}`).toEqual([ALLOWED]);
  });
});

describe("the counts a band group heading carries", () => {
  const subject = referral();
  const candidatesOf = () => candidatesFor(subject, allUnits(), NOW);

  it("counts the verdicts the rows actually carry, never a fresh recomputation", () => {
    // The structural claim, tested by making a recomputation and the rendered rows disagree on
    // purpose. Every candidate's verdict is INVERTED before grouping, so any implementation that
    // asked `referralEligibility` again would report the true eligibility while the rows beneath
    // showed the opposite. Reading the verdict off the candidate is the only way to pass.
    const real = candidatesOf();
    const trulyAccepting = real.filter((candidate) => candidate.verdict.eligible).length;
    expect(trulyAccepting, "every unit gives the same verdict — inverting them would prove nothing").toBeGreaterThan(0);
    expect(trulyAccepting).toBeLessThan(real.length);

    const inverted = real.map((candidate) => ({
      ...candidate,
      verdict: { ...candidate.verdict, eligible: !candidate.verdict.eligible },
    }));
    const groups = groupCandidatesByTravelBand(subject, inverted);

    let accepting = 0;
    let units = 0;
    for (const group of groups) {
      const counts = travelBandGroupCounts(group);
      // Per group: exactly the rows in it, and exactly the rows in it that say they accept.
      expect(counts.units).toBe(group.candidates.length);
      expect(counts.accepting).toBe(group.candidates.filter((candidate) => candidate.verdict.eligible).length);
      accepting += counts.accepting;
      units += counts.units;
    }
    expect(units).toBe(real.length);
    // The decisive line: the headings follow the inverted rows, not the real eligibility.
    expect(accepting).toBe(real.length - trulyAccepting);
    expect(accepting).not.toBe(trulyAccepting);
  });

  it("adds up across the groups to exactly what the whole candidate list shows", () => {
    const candidates = candidatesOf();
    const counts = groupCandidatesByTravelBand(subject, candidates).map(travelBandGroupCounts);
    expect(counts.reduce((total, entry) => total + entry.units, 0)).toBe(candidates.length);
    expect(counts.reduce((total, entry) => total + entry.accepting, 0)).toBe(
      candidates.filter(candidateAccepts).length,
    );
    for (const entry of counts) expect(entry.accepting).toBeLessThanOrEqual(entry.units);
  });

  it("returns zeroes for a band no unit sits in, so the heading can still be rendered", () => {
    const emptyBandOf = (bands: (string | undefined)[]) => TRAVEL_BANDS.find((band) => !bands.includes(band));
    const homeRegion = regionWhere((bands) => emptyBandOf(bands) !== undefined);
    expect(homeRegion, "no home region leaves a band empty — the zero case is untestable").not.toBeNull();
    const emptyBand = emptyBandOf(bandsAcrossNetwork(homeRegion!))!;

    const local = referral({ homeRegion: homeRegion! });
    const groups = groupCandidatesByTravelBand(local, candidatesFor(local, allUnits(), NOW));
    const empty = groups.find((group) => group.band === emptyBand)!;
    // "None within an hour" is the answer a coordinator came for. Zero, not absent.
    expect(travelBandGroupCounts(empty)).toEqual({ units: 0, accepting: 0 });
  });

  it("reports two present facts and nothing about what is missing", () => {
    // No completeness figure, no tally of what the fixture failed to record, nothing that reads as
    // a shortfall. A `missing`, `notRecorded`, `total` or `of` key appearing here is how a heading
    // starts reporting an absence as a number.
    const groups = groupCandidatesByTravelBand(subject, candidatesOf());
    for (const group of groups)
      expect(Object.keys(travelBandGroupCounts(group)).sort()).toEqual(["accepting", "units"]);
  });

  it("is the only place the match view decides what accepting means", () => {
    // One exported function, not two files agreeing. If the screen spells the verdict itself again,
    // a heading and the rows beneath it can drift apart without either looking wrong.
    const source = readFileSync(
      join(resolve(process.cwd(), "src"), "components", "ward-management", "referrals", "referral-match.tsx"),
      "utf8",
    );
    expect(source).toContain("candidateAccepts");
    expect(source).not.toMatch(/verdict\.eligible/);
  });
});

describe("the out-of-area ledger over the seeded wards", () => {
  /**
   * The seeded demonstration. Everything above this block is built from small hand-made fixtures,
   * which is how the RULES are proved; this block runs the same derivation over the realistic
   * occupancy the phase will actually render — 267 admissions across 23 units — so a rule that
   * holds on three synthetic rows and collapses on real data cannot pass unnoticed.
   *
   * `now` is the seed's OWN anchor. Reading it with any other value would silently reprice every
   * stay length in the fixture.
   */
  const units = allUnits();
  const ledger = outOfAreaLedger(wardAdmissions, units, WARD_ADMISSIONS_ANCHOR);
  const entryIds = ledger.entries.map((entry) => entry.admission.id);
  const admissionById = (id: string) => wardAdmissions.find((admission) => admission.id === id);

  /**
   * THE GUARD THAT HAD TO TRAVEL WITH THE FIXTURE. `WARD_ADMISSIONS_ANCHOR` is a second copy of
   * `NOW_ANCHOR`, written out in the seed because `tests/ward-flow-single-source.test.ts` limits
   * reads of the shared constant under `src/` to three named files and the seed is not one.
   *
   * A drifted copy is close to undetectable by anything else: every seeded stay length would
   * shift together, every band would silently re-bucket, and every test would read the same stale
   * value and agree with itself. The seed ships its own copy of this assertion in
   * `tests/ward-admissions-seed.test.ts` — but that file does not currently load (see this task's
   * report), so as things stand this is the only place the check actually runs.
   */
  it("holds the seed's duplicated time anchor equal to the shared one", () => {
    expect(
      WARD_ADMISSIONS_ANCHOR,
      "the seed's copy of the operating-day anchor has drifted from NOW_ANCHOR — every seeded stay length is now wrong",
    ).toBe(NOW_ANCHOR);
  });

  it("measures every entry from its own arrival, against the seed's anchor", () => {
    expect(ledger.entries.length).toBeGreaterThan(0);
    for (const entry of ledger.entries) {
      expect(entry.sinceArrival).toBe(WARD_ADMISSIONS_ANCHOR - entry.admission.arrivedAt!);
    }
  });

  it("counts occupied out-of-area beds, and every entry is genuinely one", () => {
    for (const entry of ledger.entries) {
      expect(entry.admission.state).not.toBe("left");
      expect(typeof entry.admission.arrivedAt).toBe("number");
      expect(OUT_OF_AREA_BANDS).toContain(entry.band);
      // Looked up, never stored, and never taken from anywhere but the occupied unit's own site.
      expect(entry.admission.homeRegion, `${entry.admission.id} must carry a home region`).not.toBeNull();
      expect(entry.band).toBe(travelBand(entry.admission.homeRegion!, entry.unit.siteCode));
    }
    // The seed author's own named examples. These ARE coupled to the placeholder band table, and
    // that coupling is declared rather than hidden: when somebody replaces those invented values
    // with measured ones, this list and the one in the not-recorded test below are what move. No
    // band is named here, and no total is pinned.
    for (const id of ["AD-RPHS-01", "AD-SCGA-03", "AD-ARMA-01"]) {
      expect(entryIds, `${id} should be an occupied out-of-area bed in the seed`).toContain(id);
    }
  });

  it("reports admissions it cannot classify as notBanded, never as out of area", () => {
    expect(ledger.notBanded).toBeGreaterThan(0);
    for (const id of ["AD-RPHS-03", "AD-RPHS-05"]) {
      const admission = admissionById(id);
      expect(admission, `${id} is missing from the seed`).toBeDefined();
      const unit = units.find((candidate) => candidate.id === admission!.unitId)!;
      expect(admission!.homeRegion, `${id} must carry a home region`).not.toBeNull();
      expect(travelBand(admission!.homeRegion!, unit.siteCode)).toBeUndefined();
      expect(entryIds, `${id} has no recorded band and must never be counted as out of area`).not.toContain(id);
    }
  });

  it("drops somebody who has LEFT an out-of-area bed, and that exclusion is doing work", () => {
    for (const id of ["AD-LEFT-01", "AD-LEFT-04"]) {
      const departed = admissionById(id);
      expect(departed, `${id} is missing from the seed`).toBeDefined();
      expect(departed!.state).toBe("left");
      expect(entryIds, "somebody who has left is not in a bed far from home").not.toContain(id);

      // THE SELF-CHECK, and the reason AD-LEFT-02 is deliberately not used here. Absence alone
      // would also be satisfied by a departure whose band simply is not out of area, which is
      // exactly what AD-LEFT-02 is. Putting the same person back in the same bed must produce an
      // entry — so the exclusion above is the departure check doing work, not the band.
      const stillHere: Admission = { ...departed!, state: "occupied", leftAt: null };
      const returned = outOfAreaLedger([stillHere], units, WARD_ADMISSIONS_ANCHOR);
      expect(
        returned.entries.map((entry) => entry.admission.id),
        `${id} was excluded because of its band, not because it had left — this test proves nothing`,
      ).toEqual([id]);
    }
  });

  it("keeps the two counts apart, at a ratio where conflating them would mislead badly", () => {
    // On this seed the unclassified count outnumbers the out-of-area count by roughly twelve to
    // one. At that ratio any construction implying the unclassified figure is a shortfall, a
    // remainder or an incompleteness OF the out-of-area figure would not be a small presentational
    // slip — it would be the dominant reading of the screen, and it would be false. They are two
    // counts of two different things: how many people are in a bed far from home, and how many
    // beds this prototype cannot place at all.
    expect(Object.keys(ledger).sort()).toEqual(["entries", "notBanded"]);
    expect(ledger.notBanded).toBeGreaterThan(ledger.entries.length);
    // Asserted as floors and a relation, never as totals. Pinning the exact counts would pin a
    // consequence of the invented band table, which no test in this file may do.
    expect(ledger.entries.length).toBeGreaterThan(0);
  });

  it("never counts one admission in both numbers, and never counts one twice", () => {
    expect(new Set(entryIds).size).toBe(entryIds.length);
    const classified = ledger.entries.length + ledger.notBanded;
    // Not a denominator, and deliberately not asserted as one: this is a sanity bound proving no
    // admission was counted in both, not a whole either figure is a part of.
    expect(classified).toBeLessThanOrEqual(wardAdmissions.length);
  });
});

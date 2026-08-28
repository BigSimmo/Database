// tests/ward-travel-grouping.test.ts
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  NOT_RECORDED_LABEL,
  OUT_OF_AREA_BANDS,
  TRAVEL_BAND_LABELS,
  TRAVEL_BANDS,
  unitTravelBand,
} from "../src/components/ward-management/ward-distance";
import { referralEligibility } from "../src/components/ward-management/ward-eligibility";
import {
  HOME_REGIONS,
  type HomeRegion,
  type Referral,
  type Sex,
  type Unit,
} from "../src/components/ward-management/ward-model";
import { referrals as seededReferrals } from "../src/components/ward-management/ward-movements";
import {
  groupCandidatesByTravelBand,
  outOfAreaLedger,
  referralCandidates,
  type ReferralCandidate,
} from "../src/components/ward-management/ward-referrals";
import { allUnits } from "../src/components/ward-management/ward-sites";

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

function referral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "RF-TEST",
    ageBand: "Adult",
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    homeRegion: "Perth Metropolitan",
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    state: "queued",
    ...overrides,
  };
}

/** The grouping's own key order, derived from `TRAVEL_BANDS` so no test hand-writes a parallel
 *  list of band names — the defect that once left two screens disagreeing about what bands exist. */
const GROUP_ORDER: string[] = [...TRAVEL_BANDS, "not_recorded"];

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
    const groups = groupCandidatesByTravelBand(subject, referralCandidates(subject, allUnits(), NOW));
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
    const groups = groupCandidatesByTravelBand(subject, referralCandidates(subject, allUnits(), NOW));
    expect(groups).toHaveLength(GROUP_ORDER.length);
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
    const candidates = referralCandidates(subject, allUnits(), NOW);
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
      const groups = groupCandidatesByTravelBand(subject, referralCandidates(subject, units, NOW));
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
    const groups = groupCandidatesByTravelBand(subject, referralCandidates(subject, units, NOW));
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
    const groups = groupCandidatesByTravelBand(subject, referralCandidates(subject, allUnits(), NOW));
    const headings = groups.map((group) =>
      group.band === "not_recorded" ? NOT_RECORDED_LABEL : TRAVEL_BAND_LABELS[group.band],
    );
    expect(headings).toHaveLength(GROUP_ORDER.length);
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
    const candidates = referralCandidates(subject, units, NOW);
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

  it("decides eligibility identically wherever the person lives", () => {
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

    for (const candidate of allUnits()) {
      for (const shape of shapesFor(candidate)) {
        const swept = HOME_REGIONS.map((homeRegion) => {
          const subject = referral({ ...shape, homeRegion });
          return {
            homeRegion,
            band: unitTravelBand(subject, candidate),
            verdict: referralEligibility(subject, candidate, NOW),
          };
        });
        const reference = swept[0];
        for (const entry of swept) {
          expect(
            entry.verdict.eligible,
            `${candidate.id} changed its verdict for a person from ${entry.homeRegion} — something is reading distance`,
          ).toBe(reference.verdict.eligible);
          expect(gateFingerprint(entry.verdict)).toEqual(gateFingerprint(reference.verdict));
        }
        for (const entry of swept) {
          if (entry.band === undefined || !OUT_OF_AREA_BANDS.includes(entry.band)) continue;
          outOfAreaPairsSwept += 1;
          if (entry.verdict.eligible) outOfAreaPairsAccepted += 1;
        }
      }
    }

    // The invariance above proves nothing unless the sweep really covered out-of-area pairs, and
    // the claim a coordinator reads — a bed three hours away that accepts this referral still says
    // so, and still carries its Accept control — needs at least one of them to be accepting.
    expect(outOfAreaPairsSwept, "the sweep covered no out-of-area pair — invariance proves nothing").toBeGreaterThan(0);
    expect(
      outOfAreaPairsAccepted,
      "no out-of-area bed in the fixture accepts anybody — 'distance does not gate' is unproven",
    ).toBeGreaterThan(0);
  });

  it("names no eligibility gate after travel, distance or a band", () => {
    const distanceish = /travel|distance|band|proximity|remote|near|far|kilometre|kilometer|\bkm\b/i;
    const seen = new Set<string>();
    for (const candidate of allUnits()) {
      for (const homeRegion of HOME_REGIONS) {
        for (const gate of referralEligibility(referral({ homeRegion }), candidate, NOW).gates) seen.add(gate.gate);
      }
    }
    expect(seen.size, "no gates were collected — this sweep proves nothing").toBeGreaterThan(0);
    for (const gate of seen) expect(gate).not.toMatch(distanceish);
  });
});

describe("the out-of-area ledger", () => {
  const units = allUnits();
  const acceptingUnit = units.find((candidate) => candidate.id === "fsh-adult-secure")!;

  it("counts only accepted arrivals whose band is a member of OUT_OF_AREA_BANDS", () => {
    const { entries } = outOfAreaLedger(seededReferrals, units, NOW);
    expect(entries.length, "the seed holds no out-of-area arrival — the ledger has nothing to prove").toBeGreaterThan(
      0,
    );
    for (const entry of entries) {
      expect(OUT_OF_AREA_BANDS).toContain(entry.band);
      expect(entry.referral.state).toBe("accepted");
      expect(typeof entry.referral.arrivedAt).toBe("number");
      expect(entry.unit.id).toBe(entry.referral.acceptedUnitId);
      // The band is looked up from the ACCEPTING UNIT'S site, never stored and never guessed.
      expect(entry.band).toBe(unitTravelBand(entry.referral, entry.unit));
    }
  });

  it("counts an arrival whose band the fixture does not record as notBanded, never as out of area", () => {
    const homeRegion = HOME_REGIONS.find(
      (region) => unitTravelBand(referral({ homeRegion: region }), acceptingUnit) === undefined,
    );
    expect(homeRegion, "no home region is unrecorded for this site — the unbanded case is untestable").toBeDefined();

    const subject = referral({
      id: "RF-UNBANDED",
      homeRegion: homeRegion!,
      sex: "Male",
      secureBedNeeded: true,
      state: "accepted",
      acceptedUnitId: acceptingUnit.id,
      decidedAt: NOW - 40,
      arrivedAt: NOW - 20,
    });
    const ledger = outOfAreaLedger([subject], units, NOW);
    expect(ledger.entries).toEqual([]);
    expect(ledger.notBanded).toBe(1);
  });

  it("puts an accepted referral with no arrival in neither number", () => {
    const subject = referral({
      id: "RF-NOARRIVAL",
      state: "accepted",
      acceptedUnitId: acceptingUnit.id,
      decidedAt: NOW - 40,
    });
    expect(outOfAreaLedger([subject], units, NOW)).toEqual({ entries: [], notBanded: 0 });
  });

  it("skips an accepted arrival whose unit no longer resolves rather than banding it against a guess", () => {
    const subject = referral({
      id: "RF-NOUNIT",
      state: "accepted",
      acceptedUnitId: "a-unit-that-does-not-exist",
      decidedAt: NOW - 40,
      arrivedAt: NOW - 20,
    });
    expect(outOfAreaLedger([subject], units, NOW)).toEqual({ entries: [], notBanded: 0 });
  });

  it("runs the clock from arrivedAt, never from decidedAt", () => {
    const outOfAreaRegion = HOME_REGIONS.find((region) => {
      const band = unitTravelBand(referral({ homeRegion: region }), acceptingUnit);
      return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
    });
    expect(outOfAreaRegion, "no home region is out of area for this site — the clock case is untestable").toBeDefined();

    const arrivedAt = NOW - 20;
    const decidedAt = NOW - 45;
    const subject = referral({
      id: "RF-CLOCK",
      homeRegion: outOfAreaRegion!,
      sex: "Male",
      secureBedNeeded: true,
      state: "accepted",
      acceptedUnitId: acceptingUnit.id,
      decidedAt,
      arrivedAt,
    });
    const { entries } = outOfAreaLedger([subject], units, NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0].sinceArrival).toBe(NOW - arrivedAt);
    // Two different facts, and the difference is the whole point of recording an arrival at all.
    expect(entries[0].sinceArrival).not.toBe(NOW - decidedAt);
  });

  it("reports two counts with no shared denominator to read a proportion from", () => {
    // `notBanded` and `entries.length` count two different things. A `total`, `of`, `all` or
    // `percentage` key appearing here is how a later screen comes to present them as parts of one
    // whole, which neither this derivation nor any screen may do.
    expect(Object.keys(outOfAreaLedger(seededReferrals, units, NOW)).sort()).toEqual(["entries", "notBanded"]);
  });

  it("preserves the order the referrals were given in and never ranks them", () => {
    // Built synthetically, and deliberately NOT from the seed: the seed yields exactly one
    // out-of-area entry today, and a one-entry list cannot tell an unsorted ledger from a sorted
    // one — a test that can only ever see one row is not a guard against ordering at all. These
    // two are listed newest-arrival-first, so any comparator (longest waiting first, most recent
    // first, by band, by unit) moves at least one of them.
    const outOfAreaRegion = HOME_REGIONS.find((region) => {
      const band = unitTravelBand(referral({ homeRegion: region }), acceptingUnit);
      return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
    });
    expect(
      outOfAreaRegion,
      "no home region is out of area for this site — the ordering case is untestable",
    ).toBeDefined();

    const arrival = (id: string, arrivedAt: number): Referral =>
      referral({
        id,
        homeRegion: outOfAreaRegion!,
        sex: "Male",
        secureBedNeeded: true,
        state: "accepted",
        acceptedUnitId: acceptingUnit.id,
        decidedAt: arrivedAt - 5,
        arrivedAt,
      });
    const given = [arrival("RF-ORDER-RECENT", NOW - 10), arrival("RF-ORDER-OLDEST", NOW - 300)];

    const { entries } = outOfAreaLedger(given, units, NOW);
    expect(entries).toHaveLength(2);
    // This is a ledger of people, not a queue. Nothing here ranks, prioritises or shortlists.
    expect(entries.map((entry) => entry.referral.id)).toEqual(["RF-ORDER-RECENT", "RF-ORDER-OLDEST"]);
  });
});

describe("only ward-distance.ts reads the travel-band fixture", () => {
  // A band looked up in two places is a band that can disagree with itself between two screens —
  // the exact defect Phase 5 shipped and caught only by screenshot. Scoped to `src/` deliberately:
  // `tests/ward-travel-bands.test.ts` imports the fixture legitimately, to assert its structure,
  // and a contract test that goes red on correct code is one whoever meets it will weaken.
  //
  // Checked against IMPORT STATEMENTS, never whole file bodies: `ward-movements.ts` and
  // `ward-model.ts` both name `SYNTHETIC_TRAVEL_BANDS` in prose comments explaining why they do
  // NOT store a band, and a whole-file check would call those explanations violations.
  const SRC_ROOT = resolve(process.cwd(), "src");
  const ALLOWED = join("components", "ward-management", "ward-distance.ts");

  function importStatementsOf(source: string): string[] {
    return source.match(/import\s+[\s\S]*?;/g) ?? [];
  }

  it("no module under src imports ward-travel-bands.ts except ward-distance.ts", () => {
    const files = readdirSync(SRC_ROOT, { recursive: true, encoding: "utf8" }).filter((file) => /\.tsx?$/.test(file));
    expect(files.length, "the src sweep collected no files — this contract would prove nothing").toBeGreaterThan(50);

    const importers = files.filter((file) =>
      importStatementsOf(readFileSync(join(SRC_ROOT, file), "utf8")).some((statement) =>
        /ward-travel-bands|SYNTHETIC_TRAVEL_BANDS/.test(statement),
      ),
    );

    // The detector must be shown to detect. `ward-distance.ts` really does import the fixture, so
    // an empty result here would mean the sweep was broken, not that the contract holds.
    expect(importers).toContain(ALLOWED);
    expect(importers).toEqual([ALLOWED]);
  });
});

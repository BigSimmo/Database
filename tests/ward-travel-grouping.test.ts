// tests/ward-travel-grouping.test.ts
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
} from "../src/components/ward-management/ward-model";
import { referrals as seededReferrals } from "../src/components/ward-management/ward-movements";
import {
  candidateAccepts,
  groupCandidatesByTravelBand,
  outOfAreaLedger,
  referralCandidates,
  travelBandGroupCounts,
  type OutOfAreaEntry,
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
    const groups = groupCandidatesByTravelBand(subject, referralCandidates(subject, allUnits(), NOW));
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
    const groups = groupCandidatesByTravelBand(subject, referralCandidates(subject, allUnits(), NOW));
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
            verdict: referralEligibility(subject, candidate, NOW),
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
        for (const gate of referralEligibility(referral({ homeRegion }), candidate, NOW).gates) seen.add(gate.gate);
      }
    }
    expect(seen.size, "no gates were collected — this sweep proves nothing").toBeGreaterThan(0);
    for (const gate of seen) expect(gate).not.toMatch(distanceish);
  });
});

describe("the out-of-area ledger", () => {
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
      (region) => unitTravelBand(referral({ homeRegion: region }), acceptingUnit!) === undefined,
    );
    expect(homeRegion, "no home region is unrecorded for this site — the unbanded case is untestable").toBeDefined();

    const subject = referral({
      id: "RF-UNBANDED",
      homeRegion: homeRegion!,
      sex: "Male",
      secureBedNeeded: true,
      state: "accepted",
      acceptedUnitId: acceptingUnit!.id,
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
      acceptedUnitId: acceptingUnit!.id,
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
      const band = unitTravelBand(referral({ homeRegion: region }), acceptingUnit!);
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
      acceptedUnitId: acceptingUnit!.id,
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
    // REWRITTEN after review. The previous version used two arrivals at ONE unit, given
    // newest-first, and its own comment claimed that caught four comparators. It caught one.
    // "Most recently arrived first" — the exact idiom `recentlyDecidedReferrals` uses in this very
    // source file, and so the one most likely to be written by somebody being helpful — was a
    // NO-OP against it, and so were "shortest wait first", "by band" and "by unit".
    //
    // Three arrivals now, given in middle/oldest/newest order, spread across two out-of-area sites
    // with different bands. Everything is located by SEARCH, so a fixture change surfaces as a
    // loud skip-reason rather than silently making the test vacuous the way the last one did.
    const outOfAreaAt = (homeRegion: HomeRegion) =>
      allUnits().filter((candidate) => {
        const band = unitTravelBand(referral({ homeRegion }), candidate);
        return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
      });

    // Two units at DIFFERENT sites, out of area for one shared home region, and carrying different
    // bands — so a comparator on band and a comparator on unit both have something to move.
    let placement: { homeRegion: HomeRegion; first: Unit; second: Unit } | null = null;
    for (const homeRegion of HOME_REGIONS) {
      const far = outOfAreaAt(homeRegion);
      const first = far[0];
      const second = far.find(
        (candidate) =>
          first &&
          candidate.siteCode !== first.siteCode &&
          unitTravelBand(referral({ homeRegion }), candidate) !== unitTravelBand(referral({ homeRegion }), first),
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

    const arrival = (id: string, unit: Unit, arrivedAt: number): Referral =>
      referral({
        id,
        homeRegion,
        sex: "Male",
        ageBand: unit.cohort,
        secureBedNeeded: unit.security === "Secure",
        state: "accepted",
        acceptedUnitId: unit.id,
        decidedAt: arrivedAt - 5,
        arrivedAt,
      });

    // Middle, oldest, newest — an order that is not sorted by arrival in either direction.
    const given = [
      arrival("RF-ORDER-MIDDLE", first, NOW - 120),
      arrival("RF-ORDER-OLDEST", second, NOW - 300),
      arrival("RF-ORDER-NEWEST", first, NOW - 10),
    ];
    const givenIds = given.map((entry) => entry.id);

    const { entries } = outOfAreaLedger(given, units, NOW);
    expect(entries).toHaveLength(3);
    // This is a ledger of people, not a queue. Nothing here ranks, prioritises or shortlists.
    expect(entries.map((entry) => entry.referral.id)).toEqual(givenIds);

    // The fixture must be able to DETECT each comparator somebody might helpfully add. Asserting
    // that the given order differs from every plausible sorted order is what makes the assertion
    // above a guard rather than a coincidence — this is precisely the check the previous version
    // lacked, and lacking it is why its own comment was wrong about three of the four.
    const orderedBy = (compare: (a: OutOfAreaEntry, b: OutOfAreaEntry) => number) =>
      [...entries].sort(compare).map((entry) => entry.referral.id);
    const detectable: [string, string[]][] = [
      ["most recently arrived first", orderedBy((a, b) => b.referral.arrivedAt! - a.referral.arrivedAt!)],
      ["longest waiting first", orderedBy((a, b) => a.referral.arrivedAt! - b.referral.arrivedAt!)],
      ["shortest wait first", orderedBy((a, b) => a.sinceArrival - b.sinceArrival)],
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
    let out = "";
    let index = 0;
    let mode: "code" | "line" | "block" | "'" | '"' | "`" = "code";
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
        if (character === "'" || character === '"' || character === "`") mode = character;
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
      // Inside a string literal: an escape consumes the next character, so an escaped quote
      // cannot close it early.
      if (character === "\\") {
        out += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (character === mode) mode = "code";
      out += character;
      index += 1;
    }
    return out;
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
  });

  it("no module under src reads ward-travel-bands.ts except ward-distance.ts", () => {
    const files = readdirSync(SRC_ROOT, { recursive: true, encoding: "utf8" }).filter((file) => /\.tsx?$/.test(file));
    expect(files.length, "the src sweep collected no files — this contract would prove nothing").toBeGreaterThan(50);

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
  const candidatesOf = () => referralCandidates(subject, allUnits(), NOW);

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
    const groups = groupCandidatesByTravelBand(local, referralCandidates(local, allUnits(), NOW));
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

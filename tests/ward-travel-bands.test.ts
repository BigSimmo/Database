import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE,
  NOT_RECORDED_LABEL,
  OUT_OF_AREA_BANDS,
  SYNTHETIC_TRAVEL_TIMES_NOTICE,
  TRAVEL_BAND_LABELS,
  TRAVEL_BANDS,
  travelBand,
  unitTravelBand,
  type TravelBand,
} from "../src/components/ward-management/ward-distance";
import { HOME_REGIONS, type HomeRegion, type Referral, type Unit } from "../src/components/ward-management/ward-model";
import { referrals } from "../src/components/ward-management/ward-movements";
import { wardSites } from "../src/components/ward-management/ward-sites";
import { SYNTHETIC_TRAVEL_BANDS } from "../src/components/ward-management/ward-travel-bands";

/**
 * Phase 8 Task 1. What this file may and may not assert, because getting that boundary wrong is
 * the whole risk of the phase.
 *
 * `SYNTHETIC_TRAVEL_BANDS` sits beside REAL hospital names and every value in it is invented.
 * Nobody has measured or checked the travel time between any Western Australian region and any
 * hospital in that table, and the values were chosen to exercise the four bands rather than to
 * resemble geography. The day somebody replaces them with checked figures, replacing that one
 * file's values must be the whole change.
 *
 * So NO test here may assert a specific band for a specific place. A test reading
 * `expect(travelBand("Kimberley", "RPH")).toBe("three_hours_or_more")` would quietly promote an
 * invented placeholder into a pinned expectation, and the owner's future correction would arrive
 * as a test failure — which is exactly the pressure that turns a placeholder into a claim.
 *
 * Everything below therefore asserts MECHANISM (which field is read, what an unrecorded pair
 * returns, that the labels derive from the array) or STRUCTURE (counts, gaps, subset relations).
 * Where a test needs a concrete pair it SEARCHES the fixture for one with the required shape and
 * fails loudly if none exists, rather than naming a region and a hospital in the assertion.
 */

const SITE_CODES = wardSites.map((site) => site.code);
const ALL_UNITS: Unit[] = wardSites.flatMap((site) => site.units);

/** A region the fixture records nothing at all for — the whole-region gap. */
const REGIONS_WITH_NO_BANDS: HomeRegion[] = HOME_REGIONS.filter(
  (region) => SYNTHETIC_TRAVEL_BANDS[region] === undefined,
);

/** Home regions a seeded referral actually uses, so the gap wording renders in the seeded data. */
const SEEDED_HOME_REGIONS: HomeRegion[] = [...new Set(referrals.map((referral) => referral.homeRegion))];

/** Every (region, site) pair the fixture records, flattened. */
const RECORDED_PAIRS: { region: HomeRegion; siteCode: string; band: TravelBand }[] = HOME_REGIONS.flatMap((region) =>
  SITE_CODES.flatMap((siteCode) => {
    const band = SYNTHETIC_TRAVEL_BANDS[region]?.[siteCode];
    return band === undefined ? [] : [{ region, siteCode, band }];
  }),
);

/** Every (region, site) pair the fixture leaves unrecorded — the gaps, counted. */
const UNRECORDED_PAIRS: { region: HomeRegion; siteCode: string }[] = HOME_REGIONS.flatMap((region) =>
  SITE_CODES.flatMap((siteCode) =>
    SYNTHETIC_TRAVEL_BANDS[region]?.[siteCode] === undefined ? [{ region, siteCode }] : [],
  ),
);

/** Any home region for which the fixture records a band at EVERY site in the network. */
const COMPLETELY_MAPPED_REGIONS: HomeRegion[] = HOME_REGIONS.filter((region) =>
  SITE_CODES.every((siteCode) => SYNTHETIC_TRAVEL_BANDS[region]?.[siteCode] !== undefined),
);

const WARD_DIR = join(process.cwd(), "src", "components", "ward-management");
const MODULE_FILES = ["ward-distance.ts", "ward-travel-bands.ts"];

/**
 * Source with comments removed, so a digit in prose ("Phase 8", "the four bands") is not mistaken
 * for a written-down figure. Neither module contains a `//` or `/*` sequence inside a string
 * literal, so the naive strip is exact for these two files.
 */
function codeWithoutComments(fileName: string): string {
  return readFileSync(join(WARD_DIR, fileName), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("travel bands", () => {
  it("returns undefined for a pair the fixture does not record, and never falls back to a band", () => {
    // A region the table omits entirely — the outer lookup misses.
    const absentRegion = REGIONS_WITH_NO_BANDS[0];
    expect(absentRegion, "the fixture must leave at least one whole home region unrecorded").toBeDefined();
    expect(travelBand(absentRegion, SITE_CODES[0])).toBeUndefined();

    // A region the table DOES record, at a site it does not — the inner lookup misses.
    const partialPair = HOME_REGIONS.flatMap((region) => {
      if (SYNTHETIC_TRAVEL_BANDS[region] === undefined) return [];
      const missing = SITE_CODES.find((siteCode) => SYNTHETIC_TRAVEL_BANDS[region]?.[siteCode] === undefined);
      return missing === undefined ? [] : [{ region, siteCode: missing }];
    })[0];
    expect(partialPair, "the fixture must leave at least one site unrecorded within a recorded region").toBeDefined();
    expect(travelBand(partialPair.region, partialPair.siteCode)).toBeUndefined();

    // A site code that is not in the network at all.
    expect(travelBand(HOME_REGIONS[0], "not-a-site-code")).toBeUndefined();
  });

  it("reads the candidate unit's own site, never the referral's origin site", () => {
    // Search for a case where the two answers genuinely differ. Keying on `originSiteCode` is the
    // "Nearest candidates" mistake in a new coat — it would call a city bed close for someone
    // driven into a city emergency department from a long way away — so the test is worthless
    // unless the referral's home region and origin site disagree about the answer.
    const divergent = RECORDED_PAIRS.flatMap((pair) => {
      const unit = ALL_UNITS.find((candidate) => candidate.siteCode === pair.siteCode);
      if (unit === undefined) return [];
      const originSiteCode = SITE_CODES.find(
        (code) => code !== pair.siteCode && travelBand(pair.region, code) !== pair.band,
      );
      return originSiteCode === undefined ? [] : [{ ...pair, unit, originSiteCode }];
    })[0];

    expect(
      divergent,
      "the fixture must contain a recorded unit site whose band differs from some other site in the same region",
    ).toBeDefined();

    const referral: Referral = {
      ...referrals[0],
      homeRegion: divergent.region,
      originSiteCode: divergent.originSiteCode,
    };

    expect(unitTravelBand(referral, divergent.unit)).toBe(travelBand(divergent.region, divergent.unit.siteCode));
    expect(unitTravelBand(referral, divergent.unit)).not.toBe(travelBand(divergent.region, divergent.originSiteCode));
  });

  it("labels exactly the members of TRAVEL_BANDS and nothing else", () => {
    expect(Object.keys(TRAVEL_BAND_LABELS).sort()).toEqual([...TRAVEL_BANDS].sort());
    for (const band of TRAVEL_BANDS) {
      expect(TRAVEL_BAND_LABELS[band].trim().length, `${band}'s label must not be empty`).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(TRAVEL_BAND_LABELS)).size).toBe(TRAVEL_BANDS.length);
  });

  it("gives no band a comparative label", () => {
    // `air_transport_only` is a statement about HOW you get somewhere, not about how long it
    // takes: a flight can be shorter than a drive, and this prototype knows nothing whatsoever
    // about how psychiatric patients actually move around Western Australia by air. A label
    // reading "furthest" or "most remote" would smuggle in an ordering the data does not carry.
    const comparative = /furthest|most remote|hardest|nearest|closest|best|worst/i;
    for (const [band, label] of Object.entries(TRAVEL_BAND_LABELS)) {
      expect(label, `${band}'s label must not rank the band`).not.toMatch(comparative);
    }
    expect(NOT_RECORDED_LABEL).not.toMatch(comparative);
  });

  it("expresses the out-of-area threshold as band names, with no figure written down anywhere", () => {
    expect(OUT_OF_AREA_BANDS.length).toBeGreaterThan(0);
    for (const band of OUT_OF_AREA_BANDS) {
      expect(TRAVEL_BANDS).toContain(band);
    }
    expect(OUT_OF_AREA_BANDS.length).toBeLessThan(TRAVEL_BANDS.length);

    // The threshold is a list of band names precisely so that no number is written down: a
    // numeric literal here would be an invented figure needing real provenance, and could be
    // read later as something somebody measured.
    for (const fileName of MODULE_FILES) {
      expect(codeWithoutComments(fileName), `${fileName} must contain no numeric literal`).not.toMatch(/\d/);
    }
  });

  it("ships both mandated notices verbatim, whole", () => {
    // These two sentences must reach the screen unchanged in the tasks that follow, and TRUNCATION
    // is the failure mode that matters: half of "no distance shown here should be relied on" still
    // reads like a caveat while having dropped the part that does the work. Each is therefore
    // pinned as a WHOLE string against an independent copy — never a prefix, never a fragment,
    // never a `toContain`.
    expect(SYNTHETIC_TRAVEL_TIMES_NOTICE).toBe(
      "Travel times on this screen are invented, like every bed number in this prototype. Nobody has " +
        "measured or checked how far any of these hospitals is from anywhere, and no distance shown here " +
        "should be relied on.",
    );
    expect(INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE).toBe(
      "Out of area here means three hours or more from home, or reachable only by air. This prototype " +
        "invented that line. Nobody has checked whether Western Australian mental health services already " +
        'define "out of area", and if they do, their definition replaces this one.',
    );
  });

  // The four coverage properties the authoring rule requires of the fixture, one test each, so a
  // mutation to any one of them fails on its own name rather than hiding behind an earlier
  // assertion in a shared test body.

  it("records at least one pair in every band, so no band heading is dead", () => {
    for (const band of TRAVEL_BANDS) {
      expect(
        RECORDED_PAIRS.some((pair) => pair.band === band),
        `no pair in the fixture exercises ${band}`,
      ).toBe(true);
    }
  });

  it("leaves the table deliberately incomplete, with no home region mapped at every site", () => {
    // A missing pair is a first-class answer, and a suspiciously complete band table is a review
    // finding rather than thoroughness — filling a gap is exactly the pressure that sends an
    // author to a map. Two claims: gaps genuinely exist, and no single region has been completed.
    //
    // The second is the one with teeth, and it is deliberately strict. If real, checked travel
    // times are ever measured for every site in a region, this test SHOULD fail: completing a
    // region is a governance moment that deserves a deliberate decision, not a silent green run.
    expect(UNRECORDED_PAIRS.length, "every possible pair is recorded — the table is not sparse").toBeGreaterThan(0);
    expect(COMPLETELY_MAPPED_REGIONS, "a home region is recorded at every site in the network").toEqual([]);

    // The gaps are gaps in the lookup too, not merely in the literal: nothing invents a band for
    // an unrecorded pair on the way out.
    for (const pair of UNRECORDED_PAIRS) {
      expect(travelBand(pair.region, pair.siteCode), `${pair.region} to ${pair.siteCode} must read as a gap`).toBe(
        undefined,
      );
    }
  });

  it("leaves a whole home region unrecorded that a seeded referral actually uses", () => {
    // So the whole-region gap wording renders in the seeded data rather than only under test.
    expect(REGIONS_WITH_NO_BANDS.length, "no home region is left entirely unrecorded").toBeGreaterThan(0);
    expect(
      REGIONS_WITH_NO_BANDS.some((region) => SEEDED_HOME_REGIONS.includes(region)),
      "every unrecorded home region is one no seeded referral uses, so the gap never renders",
    ).toBe(true);
  });

  it("puts at least two units in one band for one region", () => {
    // So a later no-reordering test has something to catch.
    const crowded = HOME_REGIONS.flatMap((region) =>
      TRAVEL_BANDS.filter(
        (band) => ALL_UNITS.filter((unit) => travelBand(region, unit.siteCode) === band).length >= 2,
      ).map((band) => ({ region, band })),
    );
    expect(crowded.length, "no region/band pair holds two units").toBeGreaterThan(0);
  });

  it("keys only on site codes that exist in the network", () => {
    // Derived from `wardSites`, not from the pair list — a typo in a fixture key would otherwise
    // sit in the table answering `undefined` forever with nothing to notice it.
    for (const region of HOME_REGIONS) {
      for (const siteCode of Object.keys(SYNTHETIC_TRAVEL_BANDS[region] ?? {})) {
        expect(SITE_CODES, `${siteCode} is not a site code in this network`).toContain(siteCode);
      }
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  NOT_RECORDED_LABEL,
  OUT_OF_AREA_BANDS,
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
      expect(TRAVEL_BAND_LABELS[band], `${band} needs a label`).toBeTruthy();
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

  it("records a fixture chosen for coverage: every band live, gaps real, one band holding two units", () => {
    // Every band heading has something under it, so no band is dead on the screen.
    for (const band of TRAVEL_BANDS) {
      expect(
        RECORDED_PAIRS.some((pair) => pair.band === band),
        `no pair in the fixture exercises ${band}`,
      ).toBe(true);
    }

    // The table is deliberately incomplete — a missing pair is a first-class answer, and a
    // suspiciously complete table is a review finding rather than thoroughness.
    expect(RECORDED_PAIRS.length).toBeLessThan(HOME_REGIONS.length * SITE_CODES.length);

    // A whole home region with nothing recorded, and one a seeded referral actually uses, so the
    // whole-region gap wording renders in the seeded data rather than only under test.
    expect(REGIONS_WITH_NO_BANDS.length).toBeGreaterThan(0);
    expect(REGIONS_WITH_NO_BANDS.some((region) => SEEDED_HOME_REGIONS.includes(region))).toBe(true);

    // At least two units share one band for one region, so a later no-reordering test has
    // something to catch.
    const crowded = HOME_REGIONS.flatMap((region) =>
      TRAVEL_BANDS.filter(
        (band) => ALL_UNITS.filter((unit) => travelBand(region, unit.siteCode) === band).length >= 2,
      ).map((band) => ({ region, band })),
    );
    expect(crowded.length, "no region/band pair holds two units").toBeGreaterThan(0);

    // Every site code the fixture keys on is a real code in the network, so a typo cannot sit in
    // the table silently answering `undefined` forever.
    for (const pair of RECORDED_PAIRS) {
      expect(SITE_CODES).toContain(pair.siteCode);
    }
    for (const region of HOME_REGIONS) {
      for (const siteCode of Object.keys(SYNTHETIC_TRAVEL_BANDS[region] ?? {})) {
        expect(SITE_CODES, `${siteCode} is not a site code in this network`).toContain(siteCode);
      }
    }
  });
});

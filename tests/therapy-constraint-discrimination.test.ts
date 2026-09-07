import { describe, expect, it } from "vitest";

import therapiesSource from "@/data/therapies-source.json";
import { inferRecommendConstraints, RECOMMEND_CONSTRAINTS } from "@/components/therapy-compass/data/select";
import type { Therapy } from "@/components/therapy-compass/data/types";

const therapies = therapiesSource as unknown as Therapy[];

/**
 * A Recommend constraint chip that matches every record narrows nothing, and the
 * control gives the reader no way to see that. Three of the ten did exactly that
 * against the shipped catalogue: `5min` and `15min` (both reached through
 * `briefInterventionAvailable`, which every record asserted) and `handout`.
 *
 * Three fixes, one per cause:
 *  - `briefInterventionAvailable` is derived from each record's own evidence
 *    rather than asserted, which restores `15min` to 46 of 205.
 *  - `5min` is keyed on the short `sessionLength` tiers, so it selects 24 rather
 *    than repeating the `15min` set exactly.
 *  - `handout` is removed. It was backed by `patientSheetAvailable`, true on every
 *    record, and no catalogue field distinguishes handout availability, so there
 *    was nothing to key a working chip on.
 *
 * These tests pin all three, because `therapies-source.json` is hand-maintained
 * with no generator to re-derive it and the blanket claims could return silently.
 */

/** Formats that can be delivered inside a single short contact. */
const BRIEF_CAPABLE_SESSION_LENGTHS = new Set(["5-minute intervention", "Micro skill", "Single session"]);

/**
 * A therapy can be both a multi-session course AND deliverable as a brief
 * intervention, so `sessionLength` alone produces false negatives for the
 * dual-format case. Motivational Interviewing for Substance Use Disorders is
 * exactly that: `sessionLength: "Multi-session"`, while its `timeRequired`
 * states it "may be delivered as a brief intervention, extended brief
 * intervention, or part of a broader treatment package", citing NICE and SAMHSA.
 *
 * The phrase test stays narrow on purpose. Across the catalogue it matches
 * `timeRequired` on three records and none of them negate it, so it does not
 * sweep in therapies that merely describe a short course — `telephone-delivered-cbt`
 * ("up to 4 weekly or fortnightly sessions") and `child-cbt` ("8-12 sessions of
 * 45 minutes") both stay excluded, which is correct.
 */
const BRIEF_PHRASE = /\bbrief intervention/i;
const BRIEF_PHRASE_NEGATED = /\b(?:not|never|rather than|insufficient|unsuitable)[^.]{0,60}\bbrief intervention/i;

function briefCapable(therapy: Therapy): boolean {
  if (BRIEF_CAPABLE_SESSION_LENGTHS.has((therapy.sessionLength ?? "").trim())) return true;
  const timeRequired = therapy.timeRequired ?? "";
  return BRIEF_PHRASE.test(timeRequired) && !BRIEF_PHRASE_NEGATED.test(timeRequired);
}

describe("Recommend constraint chips discriminate between records", () => {
  it("has a non-empty catalogue to test against (premise)", () => {
    expect(therapies.length).toBeGreaterThan(0);
  });

  it("derives briefInterventionAvailable from each record's own evidence", () => {
    const mismatched = therapies
      .filter((therapy) => therapy.briefInterventionAvailable !== briefCapable(therapy))
      .map((therapy) => `${therapy.slug} (sessionLength=${therapy.sessionLength ?? "null"})`);

    expect(mismatched).toEqual([]);
  });

  it("never claims a brief intervention for a multi-session or group programme without stated evidence", () => {
    const overclaiming = therapies
      .filter((therapy) => therapy.briefInterventionAvailable)
      .filter((therapy) => /multi-session|group programme/i.test(therapy.sessionLength ?? ""))
      .filter((therapy) => !BRIEF_PHRASE.test(therapy.timeRequired ?? ""))
      .map((therapy) => therapy.slug);

    expect(overclaiming).toEqual([]);
  });

  it("keeps every constraint chip discriminating rather than matching the whole catalogue", () => {
    // Guards the regression directly: `5min`, `15min` and `handout` all matched
    // all 205 records before the fix, and the control gave no sign of it.
    for (const constraint of RECOMMEND_CONSTRAINTS) {
      const matched = therapies.filter((therapy) => constraint.match(therapy)).length;
      const key = constraint.key;
      expect(matched, `constraint ${key} matched every record, so it narrows nothing`).toBeLessThan(therapies.length);
      expect(matched, `constraint ${key} matched no record, so it is equally unusable`).toBeGreaterThan(0);
    }
  });

  it("keeps the two time chips from selecting the identical set of records", () => {
    // `fifteenMinuteVersion` is null on every record, so both chips previously
    // fell through to `briefInterventionAvailable` and picked the same 46.
    const slugsFor = (key: string) => {
      const constraint = RECOMMEND_CONSTRAINTS.find((candidate) => candidate.key === key);
      expect(constraint, `constraint ${key} should exist`).toBeDefined();
      return therapies.filter((therapy) => constraint!.match(therapy)).map((therapy) => therapy.slug);
    };

    const fiveMinute = slugsFor("5min");
    const fifteenMinute = slugsFor("15min");

    expect(fiveMinute.length).toBeGreaterThan(0);
    expect(fiveMinute.length).toBeLessThan(fifteenMinute.length);
    // A five-minute contact is deliverable in any longer slot, so the shorter
    // chip must stay a strict subset rather than merely a different set.
    expect(fiveMinute.filter((slug) => !fifteenMinute.includes(slug))).toEqual([]);
  });

  it("offers no constraint chip that no catalogue field can discriminate on", () => {
    // `handout` was backed by `patientSheetAvailable`, which is true on every
    // record, and no other field distinguishes handout availability. The chip
    // was removed rather than the flag falsified.
    expect(RECOMMEND_CONSTRAINTS.map((constraint) => constraint.key)).not.toContain("handout");
    expect(inferRecommendConstraints("give them a handout or leaflet")).toEqual([]);
  });
});

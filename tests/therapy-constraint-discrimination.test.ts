import { describe, expect, it } from "vitest";

import therapiesSource from "@/data/therapies-source.json";
import { RECOMMEND_CONSTRAINTS } from "@/components/therapy-compass/data/select";
import type { Therapy } from "@/components/therapy-compass/data/types";

const therapies = therapiesSource as unknown as Therapy[];

/**
 * A Recommend constraint chip that matches every record narrows nothing, and the
 * control gives the reader no way to see that. Three of the ten did exactly that
 * against the shipped catalogue: `5min` and `15min` (both reached through
 * `briefInterventionAvailable`, which every record asserted) and `handout`.
 *
 * The `briefInterventionAvailable` half is fixed by deriving the flag from each
 * record's own `sessionLength` instead of asserting it. These tests pin that
 * derivation so a hand edit to `therapies-source.json` — which is hand-maintained,
 * with no generator to re-derive it — cannot silently reintroduce the blanket claim.
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

  it("keeps the time chips discriminating rather than matching the whole catalogue", () => {
    // Guards the regression directly: before the fix both matched all 205.
    for (const key of ["5min", "15min"]) {
      const constraint = RECOMMEND_CONSTRAINTS.find((candidate) => candidate.key === key);
      expect(constraint, `constraint ${key} should exist`).toBeDefined();

      const matched = therapies.filter((therapy) => constraint!.match(therapy)).length;
      expect(matched, `constraint ${key} matched every record, so it narrows nothing`).toBeLessThan(therapies.length);
      expect(matched, `constraint ${key} matched no record, so it is equally unusable`).toBeGreaterThan(0);
    }
  });
});

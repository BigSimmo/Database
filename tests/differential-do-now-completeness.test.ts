import { describe, expect, it } from "vitest";

import { curatedDifferentials } from "@/lib/differential-curated";
import { resolveDoNowSteps } from "@/lib/differential-detail";
import { getDifferentialRecord } from "@/lib/differentials";
import type { DifferentialRecord } from "@/lib/differentials";

function recordFor(slug: string): DifferentialRecord {
  const record = getDifferentialRecord(slug);
  if (!record) throw new Error(`missing catalogue record: ${slug}`);
  return record;
}

/**
 * Found 2026-09-16. Seven of the ten clinician-authored records carry five
 * "Do now" steps and the only surface that renders them capped at four, so the
 * fifth never appeared. In six of those seven the fifth step is the escalation
 * instruction — "escalate to intensive care", "involve the perinatal mental
 * health service", "escalate for a seizure". A reviewed list is not something
 * the layout gets to shorten.
 */
describe("authored Do now steps are never truncated", () => {
  it("returns every step of an authored list, past the generated cap", () => {
    for (const [slug, entry] of Object.entries(curatedDifferentials)) {
      if (!entry.doNow?.length) continue;
      const steps = resolveDoNowSteps(recordFor(slug), entry);
      expect(steps.length, `${slug} lost ${entry.doNow.length - steps.length} authored step(s)`).toBe(
        entry.doNow.length,
      );
      expect(steps.at(-1)).toBe(entry.doNow.at(-1));
    }
  });

  it("keeps the last authored step of each five-step record, which is usually the escalation", () => {
    // Named explicitly so a future change that re-introduces a cap fails on the
    // clinical content rather than on an arithmetic assertion.
    const cases: Array<[string, RegExp]> = [
      ["serotonin-toxicity", /Escalate to intensive care/i],
      ["alcohol-withdrawal", /Escalate for a seizure/i],
      ["postpartum-psychosis", /perinatal mental health service/i],
      ["catatonia-in-mood-disorder", /Escalate urgently/i],
      ["clozapine-specific-adverse-effects-toxicity", /clozapine coordinator/i],
      ["lithium-physiological-withdrawal-tremor", /Escalate for a level above the therapeutic range/i],
    ];

    for (const [slug, expected] of cases) {
      const steps = resolveDoNowSteps(recordFor(slug), curatedDifferentials[slug]!);
      expect(steps.join(" | "), `${slug} dropped its final step`).toMatch(expected);
    }
  });

  it("still caps the generated fallback, which is unreviewed and often noisy", () => {
    // The cap exists for records with no authored overlay, where the source is
    // the export's own "immediate action" list. That has not changed.
    const generated = {
      slug: "generated-only",
      title: "Generated only",
      status: "routine",
      subtitle: "",
      clinicalHinge: "",
      safetySnapshot: { summary: "", tags: [] },
      sections: [],
      related: [],
      currentPresentation: [],
      investigations: [],
      immediateActions: ["one", "two", "three", "four", "five", "six"],
    } satisfies DifferentialRecord;

    expect(resolveDoNowSteps(generated, null)).toEqual(["one", "two", "three", "four"]);
    expect(resolveDoNowSteps(generated, null, 2)).toEqual(["one", "two"]);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { THERAPY_CATALOGUE_ASSETS } from "@/components/therapy-compass/data/generated-assets";
import { relatedTherapies } from "@/components/therapy-compass/data/related";
import type { Therapy } from "@/components/therapy-compass/data/types";

/**
 * Run against the real catalogue, not a fixture.
 *
 * The defect this scorer replaces was a property of the corpus rather than of
 * the code: shared tags were counted equally, and `Crisis/risk` is carried by
 * 196 of the 205 records. A three-record fixture cannot reproduce that, so it
 * would have passed against the old scorer too.
 */
const catalogue = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/therapy-compass-data", THERAPY_CATALOGUE_ASSETS.full), "utf8"),
) as Therapy[];

function bySlug(slug: string): Therapy {
  const record = catalogue.find((therapy) => therapy.slug === slug);
  if (!record) throw new Error(`Expected the catalogue to carry ${slug}`);
  return record;
}

/** A record carrying tags and nothing else, so a test isolates one signal. */
function stubTherapy(slug: string, tags: string[]): Therapy {
  return {
    ...bySlug("behavioural-activation-ba"),
    slug,
    name: slug,
    aliases: [],
    tags,
    category: `${slug}-category`,
    alternatives: null,
    limitations: null,
    contraindicationsOrCautions: null,
    clinicalSummary: null,
    bestUsedFor: null,
    homework: null,
    commonPitfalls: null,
    targetSymptoms: null,
    mechanism: null,
  };
}

describe("therapy relatedness", () => {
  it("suggests trauma therapies for a trauma therapy, not just same-format siblings", () => {
    const related = relatedTherapies(catalogue, bySlug("supported-digital-trauma-focused-cbt"));
    const names = related.map((entry) => entry.therapy.name);

    expect(related).toHaveLength(4);
    // The old scorer returned four Self-Help & Digital records (Brief
    // low-intensity CBT, Guided self-help, Telephone-delivered CBT,
    // App-supported therapy) — none of which treat trauma.
    expect(related.some((entry) => entry.therapy.category === "Trauma Therapies")).toBe(true);
    expect(names.join(" ").toLowerCase()).toContain("trauma");
  });

  it("never opens with the record's own near-duplicate", () => {
    // The catalogue ships this therapy twice, the second time with its category
    // appended to the name. Under any similarity measure a record's own twin is
    // its best match, so the list would lead with the page you are already on.
    const related = relatedTherapies(catalogue, bySlug("supported-digital-trauma-focused-cbt"));
    expect(related.map((entry) => entry.therapy.slug)).not.toContain(
      "supported-digital-trauma-focused-cbt-self-help-and-digital-therapies",
    );
  });

  it("weights a rare shared tag above a near-universal one", () => {
    // Reproduces the real distribution rather than borrowing it: the catalogue
    // puts `Crisis/risk` on 196 of 205 records and `DBT` on 10. Under the old
    // equal-weight count these two candidates were indistinguishable, which is
    // why the panel filled with "shares the tag every record shares".
    const corpus = [
      ...Array.from({ length: 196 }, (_, index) => stubTherapy(`common-${index}`, ["Crisis/risk"])),
      ...Array.from({ length: 9 }, (_, index) => stubTherapy(`dbt-${index}`, ["DBT"])),
      stubTherapy("candidate-common", ["Crisis/risk"]),
      stubTherapy("candidate-rare", ["DBT"]),
    ];
    const probe = stubTherapy("probe", ["Crisis/risk", "DBT"]);
    const related = relatedTherapies([...corpus, probe], probe, 205);
    const rare = related.find((entry) => entry.therapy.slug === "candidate-rare");
    const common = related.find((entry) => entry.therapy.slug === "candidate-common");

    expect(rare).toBeDefined();
    expect(common).toBeDefined();
    expect(related.indexOf(rare!)).toBeLessThan(related.indexOf(common!));
    expect(rare!.reason).toBe("Also for dbt");
    expect(common!.reason).toBe("Also for crisis/risk");
  });

  it("labels a named candidate as named even when several shared tags would outscore that signal", () => {
    // NAMED_IN_RECORD is 8. Shared-tag score is sum(IDF) * 1.2. Three tags with
    // IDF ≈ 2.37 already exceed 8, so picking the reason by contribution score
    // would attribute the row to a tag even though the record named it.
    const rareTags = ["alpha-protocol", "beta-protocol", "gamma-protocol"];
    const corpus = [
      ...Array.from({ length: 30 }, (_, index) => stubTherapy(`filler-${index}`, [])),
      Object.assign(stubTherapy("cognitive-processing-therapy", rareTags), {
        name: "Cognitive Processing Therapy",
      }),
    ];
    const probe = stubTherapy("probe", rareTags);
    probe.alternatives = "Consider Cognitive Processing Therapy when first-line care is unavailable.";
    const related = relatedTherapies([...corpus, probe], probe, 8);
    const named = related.find((entry) => entry.therapy.slug === "cognitive-processing-therapy");

    expect(named).toBeDefined();
    expect(named!.reason).toBe("Named in this record");
  });

  it("labels every suggestion with the signal that produced it", () => {
    for (const slug of ["behavioural-activation-ba", "supported-digital-cbt", "supported-digital-trauma-focused-cbt"]) {
      for (const entry of relatedTherapies(catalogue, bySlug(slug))) {
        expect(entry.reason, `${slug} -> ${entry.therapy.slug}`).toMatch(/\S/);
      }
    }
  });

  it("is deterministic across calls", () => {
    const first = relatedTherapies(catalogue, bySlug("behavioural-activation-ba"));
    const second = relatedTherapies(catalogue, bySlug("behavioural-activation-ba"));
    expect(second.map((entry) => entry.therapy.slug)).toEqual(first.map((entry) => entry.therapy.slug));
  });

  it("never suggests the therapy being viewed", () => {
    for (const therapy of catalogue.slice(0, 40)) {
      const related = relatedTherapies(catalogue, therapy);
      expect(related.map((entry) => entry.therapy.slug)).not.toContain(therapy.slug);
    }
  });
});

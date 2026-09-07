import { describe, expect, it } from "vitest";

import {
  applyBuilderGroupRules,
  builderCatalogGroups,
  builderDiagnoses,
  builderDiagnosisGroups,
  builderGroupSelection,
  catalogDiagnosisId,
  catalogWordingSegment,
  findBuilderDiagnosis,
  guidedBuilderDiagnoses,
  resolveInitialBuilderState,
  stripSpecifierOptionList,
  toggleBuilderCatalogSlug,
} from "@/lib/specifier-builder-diagnoses";
import { specifierIndexItems } from "@/lib/specifiers-search-index";
import { findSpecifier, normalizeSpecifierSelection, specifierAppliesToBuilderDiagnosis } from "@/lib/specifiers";

const helpers = {
  normalizeSelection: normalizeSpecifierSelection,
  appliesToGuided: (slug: string, id: Parameters<typeof specifierAppliesToBuilderDiagnosis>[1]) => {
    const record = findSpecifier(slug);
    return record ? specifierAppliesToBuilderDiagnosis(record, id) : false;
  },
};

describe("specifier builder base diagnoses", () => {
  it("offers every catalogued disorder, not just the curated mood presets", () => {
    const options = builderDiagnoses();
    // The builder previously exposed five hardcoded presets while the dataset held
    // 131 disorders. Guard the breadth so that regression cannot return silently.
    expect(options.length).toBeGreaterThan(120);
    expect(options.filter((option) => option.kind === "guided")).toHaveLength(guidedBuilderDiagnoses.length);

    const labels = options.map((option) => option.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Major depressive disorder, recurrent",
        "Bipolar I disorder, current episode hypomanic",
        "Schizophrenia",
        "Autism Spectrum Disorder",
        "Post-Traumatic Stress Disorder",
        "Anorexia Nervosa",
        "Substance Use Disorders (General Specifiers)",
      ]),
    );
  });

  it("keeps ids unique and resolvable", () => {
    const ids = builderDiagnoses().map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(findBuilderDiagnosis(id)).toBeDefined();
  });

  it("suppresses the catalogue rows the curated mood presets already stand in for", () => {
    const labels = builderDiagnoses().map((option) => option.label);
    expect(labels).not.toContain("Major Depressive Disorder");
    expect(labels).not.toContain("Bipolar I Disorder");
    expect(labels).not.toContain("Bipolar II Disorder");
  });

  it("groups the select by DSM category with the curated presets first", () => {
    const groups = builderDiagnosisGroups();
    expect(groups[0]?.categoryId).toBe("guided");
    expect(groups[0]?.options).toHaveLength(guidedBuilderDiagnoses.length);
    expect(groups.map((group) => group.categoryId)).toEqual(
      expect.arrayContaining(["ndv", "psy", "trm", "eat", "sub", "per"]),
    );
    const total = groups.reduce((sum, group) => sum + group.options.length, 0);
    expect(total).toBe(builderDiagnoses().length);
  });

  it("carries each disorder's own specifier groups", () => {
    const asd = catalogDiagnosisId("ndv", "Autism Spectrum Disorder");
    const groups = builderCatalogGroups(asd);
    expect(groups.map((group) => group.label)).toEqual(["Co-occurring", "Severity"]);
    expect(groups.find((group) => group.label === "Severity")?.selection).toBe("single");
    expect(groups.find((group) => group.label === "Co-occurring")?.selection).toBe("multiple");
    expect(groups.flatMap((group) => group.items).every((item) => item.disorder === "Autism Spectrum Disorder")).toBe(
      true,
    );
  });

  it("treats graded axes as single-select and everything else as multi-select", () => {
    expect(builderGroupSelection("Severity")).toBe("single");
    expect(builderGroupSelection("Current Episode")).toBe("single");
    expect(builderGroupSelection("Type")).toBe("single");
    expect(builderGroupSelection("Features")).toBe("multiple");
    expect(builderGroupSelection("Episode Specifiers")).toBe("multiple");
    expect(builderGroupSelection("Co-occurring")).toBe("multiple");
  });

  it("keeps one pick inside a single-select group and many inside the rest", () => {
    const asd = catalogDiagnosisId("ndv", "Autism Spectrum Disorder");
    const groups = builderCatalogGroups(asd);
    const severity = groups.find((group) => group.label === "Severity")!;
    const coOccurring = groups.find((group) => group.label === "Co-occurring")!;

    const twoSeverities = applyBuilderGroupRules(groups, [severity.items[0].slug, severity.items[2].slug]);
    expect(twoSeverities).toEqual([severity.items[2].slug]);

    let selected = toggleBuilderCatalogSlug(groups, [], coOccurring.items[0].slug);
    selected = toggleBuilderCatalogSlug(groups, selected, coOccurring.items[1].slug);
    expect(selected).toHaveLength(2);
    selected = toggleBuilderCatalogSlug(groups, selected, coOccurring.items[0].slug);
    expect(selected).toEqual([coOccurring.items[1].slug]);
  });

  it("resolves curated deep links to the first compatible mood preset", () => {
    expect(resolveInitialBuilderState([], helpers)).toEqual({ diagnosisId: "mdd-recurrent", selected: [] });
    expect(resolveInitialBuilderState(["mild-severity"], helpers)).toEqual({
      diagnosisId: "mdd-recurrent",
      selected: ["mild-severity"],
    });
    expect(resolveInitialBuilderState(["with-rapid-cycling", "with-psychotic-features"], helpers)).toEqual({
      diagnosisId: "bipolar-i-depressed",
      selected: ["with-rapid-cycling", "with-psychotic-features"],
    });
  });

  it("resolves a catalogue deep link onto its own disorder", () => {
    const item = specifierIndexItems.find((candidate) => candidate.disorder === "Autism Spectrum Disorder")!;
    expect(resolveInitialBuilderState([item.slug], helpers)).toEqual({
      diagnosisId: catalogDiagnosisId(item.categoryId, item.disorder),
      selected: [item.slug],
    });
  });

  it("carries a source-review status on every catalogue option the builder can offer", () => {
    // The builder shows these rows at the moment of choosing, so each must have a status
    // the ReviewStatusBadge can render. Most of the catalogue is still awaiting formal
    // source review, and that has to stay visible rather than being implied as verified.
    const statuses = new Set(specifierIndexItems.map((item) => item.src));
    for (const status of statuses) {
      expect(["source-verified", "source-needs-formal-review", "source-not-applicable"]).toContain(status);
    }
    expect(specifierIndexItems.every((item) => Boolean(item.src))).toBe(true);
    expect(statuses.has("source-needs-formal-review")).toBe(true);
  });

  it("lowers an ordinary leading capital for the wording line but leaves structured labels alone", () => {
    expect(catalogWordingSegment("With catatonia")).toBe("with catatonia");
    expect(catalogWordingSegment("Mild (BMI 17 or above)")).toBe("mild (BMI 17 or above)");
    expect(catalogWordingSegment("Level 1: Requiring support")).toBe("Level 1: Requiring support");
    expect(catalogWordingSegment("With Lewy bodies")).toBe("with Lewy bodies");
  });

  it("drops a trailing option list from the wording so the phrase is documentable", () => {
    expect(catalogWordingSegment("With anxious distress (mild, moderate, moderate-severe, severe)")).toBe(
      "with anxious distress",
    );
    expect(catalogWordingSegment("With speech symptoms (dysphonia, slurred speech)")).toBe("with speech symptoms");
    expect(catalogWordingSegment("Current severity (mild, moderate, severe)")).toBe("current severity");
    expect(catalogWordingSegment("With or without behavioural disturbance (specify disturbance)")).toBe(
      "with or without behavioural disturbance",
    );
    expect(stripSpecifierOptionList("First episode (acute, partial, full remission)")).toBe("First episode");
  });

  it("keeps a parenthetical that qualifies the specifier rather than listing its options", () => {
    // Each of these changes what the phrase means, so stripping them would lose clinical
    // content: a threshold, a duration, a count, an age and a constraint.
    for (const label of [
      "Mild (BMI 17 or above)",
      "Acute (less than 6 months)",
      "Mild (2-3 symptoms)",
      "Early onset (before age 21)",
      "With seasonal pattern (recurrent only)",
      "Episodic (at least 1 month but less than 3 months)",
    ]) {
      expect(stripSpecifierOptionList(label)).toBe(label);
    }

    // A parenthetical that is part of a word, or sits mid-label, is never trailing.
    expect(stripSpecifierOptionList("With marked stressor(s)")).toBe("With marked stressor(s)");
    expect(stripSpecifierOptionList("Other (or unknown) substance")).toBe("Other (or unknown) substance");
  });

  it("strips every option list in the catalogue and nothing else", () => {
    const stripped = specifierIndexItems.filter((item) => stripSpecifierOptionList(item.label) !== item.label);
    // Every label the rule rewrites must have carried a comma-separated menu or a
    // "specify" instruction, and must keep text once the menu is gone.
    for (const item of stripped) {
      const inner = item.label.match(/\s+\(([^()]*)\)\s*$/)?.[1] ?? "";
      expect(inner.includes(",") || /^specify\b/i.test(inner)).toBe(true);
      expect(stripSpecifierOptionList(item.label).length).toBeGreaterThan(0);
    }
    expect(stripped.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "With anxious distress (mild, moderate, moderate-severe, severe)",
        "With impairment in reading (word reading accuracy, reading rate or fluency, reading comprehension)",
        "Stimulant (amphetamine-type, cocaine, other/unspecified)",
      ]),
    );
  });
});

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

  it("lowers an ordinary leading capital for the wording line but leaves structured labels alone", () => {
    expect(catalogWordingSegment("With catatonia")).toBe("with catatonia");
    expect(catalogWordingSegment("Mild (BMI 17 or above)")).toBe("mild (BMI 17 or above)");
    expect(catalogWordingSegment("Level 1: Requiring support")).toBe("Level 1: Requiring support");
    expect(catalogWordingSegment("With Lewy bodies")).toBe("with Lewy bodies");
  });
});

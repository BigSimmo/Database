import { describe, expect, it } from "vitest";

import {
  dsmCategories,
  dsmCriteria,
  dsmDiagnoses,
  dsmStaticParams,
  getDsmDiagnosis,
  rankDsmDiagnoses,
  resolveDsmDifferential,
} from "@/lib/dsm";

describe("DSM clinical catalogue", () => {
  it("loads every supplied diagnosis and keeps slugs unique", () => {
    expect(dsmDiagnoses).toHaveLength(146);
    expect(new Set(dsmDiagnoses.map((diagnosis) => diagnosis.slug)).size).toBe(146);
    expect(dsmStaticParams()).toHaveLength(146);
    expect(dsmCategories.reduce((total, category) => total + category.diagnosis_count, 0)).toBe(146);
  });

  it("keeps each record complete enough for the five DSM surfaces", () => {
    for (const diagnosis of dsmDiagnoses) {
      expect(diagnosis.title).toBeTruthy();
      expect(diagnosis.icd_code).toBeTruthy();
      expect(diagnosis.category.label).toBeTruthy();
      expect(dsmCriteria(diagnosis).length).toBeGreaterThan(0);
      expect(diagnosis.documentation_template).toBeTruthy();
    }
  });

  it("falls back to key features when a separate criteria display was not supplied", () => {
    const diagnosis = getDsmDiagnosis("major-depressive-disorder");
    expect(diagnosis).toBeDefined();
    expect(diagnosis?.criteria_display).toEqual([]);
    expect(dsmCriteria(diagnosis!)).toEqual(diagnosis?.key_features);
  });

  it("searches titles, ICD codes, categories, and criteria", () => {
    expect(rankDsmDiagnoses("major depressive disorder", 1)[0]?.diagnosis.slug).toBe("major-depressive-disorder");
    expect(rankDsmDiagnoses("F31.81", 1)[0]?.diagnosis.slug).toBe("bipolar-ii-disorder");
    expect(rankDsmDiagnoses("Mood Disorders", 20).length).toBeGreaterThan(1);
    expect(
      rankDsmDiagnoses("hypomanic episode", 5).some((match) => match.diagnosis.slug === "bipolar-ii-disorder"),
    ).toBe(true);
  });

  it("links named differential considerations back to catalogue records", () => {
    const diagnosis = getDsmDiagnosis("major-depressive-disorder");
    const bipolar = diagnosis?.differentials.find((item) => item.startsWith("Bipolar I or II"));
    expect(bipolar).toBeTruthy();
    expect(resolveDsmDifferential("Bipolar II disorder (hypomanic periods identified)")?.slug).toBe(
      "bipolar-ii-disorder",
    );
  });

  it("resolves initialisms after stripping title parentheticals", () => {
    expect(resolveDsmDifferential("MDD")?.slug).toBe("major-depressive-disorder");
    expect(resolveDsmDifferential("PDD")?.slug).toBe("persistent-depressive-disorder-dysthymia");
    expect(
      rankDsmDiagnoses("PDD", 5).some((match) => match.diagnosis.slug === "persistent-depressive-disorder-dysthymia"),
    ).toBe(true);
  });
});

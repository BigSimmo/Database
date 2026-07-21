import { describe, expect, it } from "vitest";

import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medication-snapshot";
import {
  evaluatePatientAlerts,
  isProfileEmpty,
  noticeToneForSemanticTone,
  type MedicationConsideration,
  type PatientProfile,
} from "@/lib/medication-patient-alerts";
import type { MedicationPatientMetadata, MedicationRecord } from "@/lib/medications";

function recordWith(patient: MedicationPatientMetadata, sectionType = "contra", key = "Test"): MedicationRecord {
  return {
    slug: "test-med",
    name: "Test Med",
    class: "",
    subclass: "",
    category: "",
    accent: "#0f766e",
    tag: "",
    schedule: "",
    stats: [],
    quick: [],
    sections: [{ title: "Test section", type: sectionType, rows: [{ key, val: "row text", patient }] }],
  };
}

function reasons(considerations: MedicationConsideration[]): string[] {
  return considerations.flatMap((consideration) => consideration.reasons);
}

describe("evaluatePatientAlerts — match-key gates", () => {
  it("age gte fires at the boundary and clears below it", () => {
    const record = recordWith({
      factors: ["elderly"],
      action: "caution",
      severity: "danger",
      match: { age: { gte: 65 } },
    });
    expect(reasons(evaluatePatientAlerts(record, { ageYears: 65 }).considerations)).toContain("Age 65 ≥ 65");
    expect(evaluatePatientAlerts(record, { ageYears: 64 }).considerations).toHaveLength(0);
  });

  it("age gt is strict and age lt catches paediatric", () => {
    const gt = recordWith({ factors: ["elderly"], action: "caution", match: { age: { gt: 65 } } });
    expect(evaluatePatientAlerts(gt, { ageYears: 65 }).considerations).toHaveLength(0);
    expect(reasons(evaluatePatientAlerts(gt, { ageYears: 66 }).considerations)).toContain("Age 66 > 65");

    const lt = recordWith({ factors: ["paediatric"], action: "contraindication", match: { age: { lt: 18 } } });
    expect(reasons(evaluatePatientAlerts(lt, { ageYears: 17 }).considerations)).toContain("Age 17 < 18");
    expect(evaluatePatientAlerts(lt, { ageYears: 18 }).considerations).toHaveLength(0);
  });

  it("egfr lt fires below the threshold only", () => {
    const record = recordWith({ factors: ["renal"], action: "caution", match: { egfr: { lt: 30 } } });
    expect(reasons(evaluatePatientAlerts(record, { egfr: 29 }).considerations)).toContain("eGFR 29 < 30 mL/min");
    expect(evaluatePatientAlerts(record, { egfr: 30 }).considerations).toHaveLength(0);
  });

  it("crcl lt is strict while lte includes the edge", () => {
    const lt = recordWith({ factors: ["renal"], action: "dose-adjust", match: { crcl: { lt: 10 } } });
    expect(evaluatePatientAlerts(lt, { crcl: 10 }).considerations).toHaveLength(0);
    expect(reasons(evaluatePatientAlerts(lt, { crcl: 9 }).considerations)).toContain("CrCl 9 < 10 mL/min");

    const lte = recordWith({ factors: ["renal"], action: "dose-adjust", match: { crcl: { lte: 50 } } });
    expect(reasons(evaluatePatientAlerts(lte, { crcl: 50 }).considerations)).toContain("CrCl 50 ≤ 50 mL/min");
    expect(evaluatePatientAlerts(lte, { crcl: 51 }).considerations).toHaveLength(0);
  });

  it("scr gt respects the µmol/L default and converts mg/dL", () => {
    const record = recordWith({ factors: ["renal"], action: "contraindication", match: { scr: { gt: 120 } } });
    expect(reasons(evaluatePatientAlerts(record, { scr: 121 }).considerations)).toContain("SCr 121 > 120 µmol/L");
    expect(evaluatePatientAlerts(record, { scr: 120 }).considerations).toHaveLength(0);
    // 1.5 mg/dL × 88.4 = 132.6 µmol/L > 120
    const converted = evaluatePatientAlerts(record, { scr: 1.5, scrUnit: "mg/dL" });
    expect(reasons(converted.considerations)).toContain("SCr 133 > 120 µmol/L");
    // 1.3 mg/dL × 88.4 = 114.9 µmol/L < 120
    expect(evaluatePatientAlerts(record, { scr: 1.3, scrUnit: "mg/dL" }).considerations).toHaveLength(0);
  });

  it("qtc gte includes the boundary", () => {
    const record = recordWith({ factors: ["qtc"], action: "monitor", match: { qtc: { gte: 450 } } });
    expect(reasons(evaluatePatientAlerts(record, { qtc: 450 }).considerations)).toContain("QTc 450 ≥ 450 ms");
    expect(evaluatePatientAlerts(record, { qtc: 449 }).considerations).toHaveLength(0);
  });

  it("hepatic matches only the listed severities and ignores none", () => {
    const record = recordWith({ factors: ["hepatic"], action: "contraindication", match: { hepatic: ["severe"] } });
    expect(reasons(evaluatePatientAlerts(record, { hepatic: "severe" }).considerations)).toContain(
      "Severe hepatic impairment",
    );
    expect(evaluatePatientAlerts(record, { hepatic: "moderate" }).considerations).toHaveLength(0);
    expect(evaluatePatientAlerts(record, { hepatic: "none" }).considerations).toHaveLength(0);
  });

  it("multiple match keys fire on OR (either criterion)", () => {
    const record = recordWith({
      factors: ["renal", "qtc"],
      action: "contraindication",
      match: { egfr: { lt: 15 }, qtc: { gte: 450 } },
    });
    expect(evaluatePatientAlerts(record, { egfr: 10 }).considerations).toHaveLength(1);
    expect(evaluatePatientAlerts(record, { qtc: 480 }).considerations).toHaveLength(1);
    expect(reasons(evaluatePatientAlerts(record, { egfr: 10, qtc: 480 }).considerations)).toEqual(
      expect.arrayContaining(["eGFR 10 < 15 mL/min", "QTc 480 ≥ 450 ms"]),
    );
  });
});

describe("evaluatePatientAlerts — factor triggers", () => {
  it("pregnancy and lactation fire from profile booleans", () => {
    const preg = recordWith({ factors: ["pregnancy", "lactation"], action: "contraindication", match: {} });
    expect(reasons(evaluatePatientAlerts(preg, { pregnant: true }).considerations)).toContain("Pregnancy");
    expect(reasons(evaluatePatientAlerts(preg, { breastfeeding: true }).considerations)).toContain("Breastfeeding");
    expect(evaluatePatientAlerts(preg, { pregnant: false, breastfeeding: false }).considerations).toHaveLength(0);
  });

  it("allergy factors fire only when the matching class is selected", () => {
    const record = recordWith({ factors: ["allergy-sulfa"], action: "contraindication", match: {} });
    expect(reasons(evaluatePatientAlerts(record, { allergies: ["sulfa"] }).considerations)).toContain("Sulfa allergy");
    expect(evaluatePatientAlerts(record, { allergies: ["penicillin"] }).considerations).toHaveLength(0);
  });

  it("derives renal/qtc/elderly/paediatric factors when no match covers them", () => {
    const renal = recordWith({ factors: ["renal"], action: "dose-adjust", match: {} });
    expect(reasons(evaluatePatientAlerts(renal, { egfr: 45 }).considerations)).toContain("Renal impairment (eGFR 45)");
    expect(evaluatePatientAlerts(renal, { egfr: 80 }).considerations).toHaveLength(0);

    const qtc = recordWith({ factors: ["qtc"], action: "monitor", match: {} });
    expect(reasons(evaluatePatientAlerts(qtc, { qtc: 470 }).considerations)).toContain("QTc 470 ≥ 450 ms");

    const elderly = recordWith({ factors: ["elderly"], action: "caution", match: {} });
    expect(reasons(evaluatePatientAlerts(elderly, { ageYears: 80 }).considerations)).toContain("Age 80 ≥ 65");

    const paed = recordWith({ factors: ["paediatric"], action: "caution", match: {} });
    expect(reasons(evaluatePatientAlerts(paed, { ageYears: 5 }).considerations)).toContain("Age 5 < 18");
  });

  it("does not double-report a factor already covered by a match key", () => {
    // acamprosate "Absolute" row: factors:["renal"] + match:{scr:{gt:120}}
    const record = getMedicationRecord("acamprosate");
    expect(record).toBeTruthy();
    const result = evaluatePatientAlerts(record!, { scr: 150 });
    const absolute = result.considerations.filter((c) => c.rowKey === "Absolute");
    expect(absolute).toHaveLength(1);
    expect(absolute[0].reasons).toEqual(["SCr 150 > 120 µmol/L"]);
    expect(reasons(result.considerations).some((r) => r.startsWith("Renal impairment"))).toBe(false);
  });
});

describe("evaluatePatientAlerts — partial / empty profile and unassessed", () => {
  it("only evaluates supplied fields", () => {
    const record = recordWith({ factors: ["renal"], action: "caution", match: { egfr: { lt: 30 } } });
    // eGFR not supplied → caution row simply does not fire, and (not a
    // contraindication) does not surface as unassessed.
    const result = evaluatePatientAlerts(record, { ageYears: 40 });
    expect(result.considerations).toHaveLength(0);
    expect(result.unassessed).toHaveLength(0);
  });

  it("flags a contraindication gate that could not be assessed", () => {
    const record = recordWith({ factors: ["renal"], action: "contraindication", match: { egfr: { lt: 30 } } });
    // Some input present (so profile is non-empty) but eGFR missing.
    const result = evaluatePatientAlerts(record, { pregnant: true });
    expect(result.considerations).toHaveLength(0);
    expect(result.unassessed).toContain("eGFR");
    // Once eGFR is supplied and safe, it is neither a consideration nor unassessed.
    const assessed = evaluatePatientAlerts(record, { egfr: 50 });
    expect(assessed.considerations).toHaveLength(0);
    expect(assessed.unassessed).toHaveLength(0);
  });

  it("treats an empty profile as empty and surfaces no considerations", () => {
    expect(isProfileEmpty({})).toBe(true);
    expect(isProfileEmpty({ scrUnit: "umol/L", allergies: [] })).toBe(true);
    expect(isProfileEmpty({ pregnant: true })).toBe(false);
    expect(isProfileEmpty({ egfr: 40 })).toBe(false);
    const record = getMedicationRecord("acamprosate");
    expect(evaluatePatientAlerts(record!, {}).considerations).toHaveLength(0);
  });
});

describe("evaluatePatientAlerts — bare-renal fail-safe (no false all-clear on partial input)", () => {
  it("surfaces unassessed when one renal input is missing and the other is present-and-normal", () => {
    const record = recordWith({ factors: ["renal"], action: "contraindication", match: {} });
    // eGFR missing, CrCl present and non-firing (>=60): must NOT read as a silent
    // all-clear — a renal contraindication clears only when BOTH inputs are present.
    const egfrMissing = evaluatePatientAlerts(record, { crcl: 90 });
    expect(egfrMissing.considerations).toHaveLength(0);
    expect(egfrMissing.unassessed).toContain("eGFR or CrCl");
    // Symmetric: CrCl missing, eGFR present-and-normal.
    const crclMissing = evaluatePatientAlerts(record, { egfr: 90 });
    expect(crclMissing.unassessed).toContain("eGFR or CrCl");
  });

  it("clears only when both renal inputs are present and non-firing", () => {
    const record = recordWith({ factors: ["renal"], action: "contraindication", match: {} });
    const result = evaluatePatientAlerts(record, { egfr: 90, crcl: 90 });
    expect(result.considerations).toHaveLength(0);
    expect(result.unassessed).toHaveLength(0);
  });

  it("still fires renal impairment on a low input", () => {
    const record = recordWith({ factors: ["renal"], action: "contraindication", match: {} });
    expect(reasons(evaluatePatientAlerts(record, { egfr: 20 }).considerations)).toContain("Renal impairment (eGFR 20)");
  });

  it("leaves non-contraindication bare-renal rows unchanged (unassessed is contraindication-only)", () => {
    // This is why the ||-guard is a no-op on the current corpus: every existing
    // bare-renal row is advisory (monitor/dose-adjust/caution/info), and missingGates
    // is only promoted to unassessed for contraindication rows.
    const record = recordWith({ factors: ["renal"], action: "monitor", match: {} });
    const result = evaluatePatientAlerts(record, { crcl: 90 });
    expect(result.considerations).toHaveLength(0);
    expect(result.unassessed).toHaveLength(0);
  });
});

describe("evaluatePatientAlerts — real records", () => {
  it("flags celecoxib for both NSAID and sulfa allergy", () => {
    const record = getMedicationRecord("celecoxib");
    expect(record).toBeTruthy();
    const nsaid = evaluatePatientAlerts(record!, { allergies: ["nsaid"] });
    expect(reasons(nsaid.considerations)).toContain("NSAID allergy");
    const sulfa = evaluatePatientAlerts(record!, { allergies: ["sulfa"] });
    expect(reasons(sulfa.considerations)).toContain("Sulfa allergy");
    expect(sulfa.considerations.some((c) => c.tone === "danger")).toBe(true);
  });

  it("orders considerations by severity, danger first", () => {
    const record = getMedicationRecord("acamprosate");
    const result = evaluatePatientAlerts(record!, { scr: 200, ageYears: 80, hepatic: "severe", pregnant: true });
    expect(result.considerations.length).toBeGreaterThan(1);
    const priority = { danger: 6, warning: 5, clinical: 4, success: 3, neutral: 2, info: 1 } as const;
    for (let i = 1; i < result.considerations.length; i += 1) {
      expect(priority[result.considerations[i - 1].tone]).toBeGreaterThanOrEqual(
        priority[result.considerations[i].tone],
      );
    }
    expect(result.highestTone).toBe("danger");
  });

  it("evaluates the whole corpus with a full profile without throwing", () => {
    const records = loadMedicationSnapshot();
    const profile: PatientProfile = {
      ageYears: 82,
      egfr: 20,
      crcl: 18,
      scr: 200,
      hepatic: "severe",
      qtc: 520,
      pregnant: true,
      breastfeeding: true,
      allergies: ["penicillin", "sulfa", "nsaid", "cephalosporin", "macrolide", "fluoroquinolone"],
    };
    for (const record of records) {
      const result = evaluatePatientAlerts(record, profile);
      for (const consideration of result.considerations) {
        expect(consideration.reasons.length).toBeGreaterThan(0);
        expect(consideration.tone).toBeTruthy();
      }
    }
    // A broadly-affected drug should surface at least one consideration.
    const acamprosate = evaluatePatientAlerts(getMedicationRecord("acamprosate")!, profile);
    expect(acamprosate.considerations.length).toBeGreaterThan(0);
  });
});

describe("noticeToneForSemanticTone", () => {
  it("maps clinical to info and passes the rest through", () => {
    expect(noticeToneForSemanticTone("clinical")).toBe("info");
    expect(noticeToneForSemanticTone("danger")).toBe("danger");
    expect(noticeToneForSemanticTone("warning")).toBe("warning");
    expect(noticeToneForSemanticTone("success")).toBe("success");
    expect(noticeToneForSemanticTone("info")).toBe("info");
    expect(noticeToneForSemanticTone("neutral")).toBe("neutral");
  });
});

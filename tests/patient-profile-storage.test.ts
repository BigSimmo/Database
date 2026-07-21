import { describe, expect, it } from "vitest";

import { evaluatePatientAlerts } from "@/lib/medication-patient-alerts";
import type { MedicationPatientMetadata, MedicationRecord } from "@/lib/medications";
import {
  PATIENT_PROFILE_NUMERIC_BOUNDS,
  PATIENT_PROFILE_SCR_UMOL_BOUNDS,
  sanitizeProfile,
} from "@/lib/patient-profile-storage";

describe("sanitizeProfile — physiological input bounds", () => {
  it("keeps in-range values, including the inclusive boundaries", () => {
    expect(sanitizeProfile({ ageYears: 82, egfr: 15, crcl: 350, qtc: 500, scr: 200 })).toMatchObject({
      ageYears: 82,
      egfr: 15,
      crcl: 350,
      qtc: 500,
      scr: 200,
    });
    // Documented clinical extremes must survive: neonate age 0, anuric eGFR/CrCl 0,
    // short-QT floor, and the upper validity ceilings.
    expect(sanitizeProfile({ ageYears: 0, egfr: 0, crcl: 0, qtc: 240 })).toMatchObject({
      ageYears: 0,
      egfr: 0,
      crcl: 0,
      qtc: 240,
    });
    expect(sanitizeProfile({ ageYears: 130, egfr: 250, crcl: 400, qtc: 800 })).toMatchObject({
      ageYears: 130,
      egfr: 250,
      crcl: 400,
      qtc: 800,
    });
  });

  it("rejects negatives and physiologically impossible magnitudes to null", () => {
    expect(sanitizeProfile({ ageYears: -1 }).ageYears).toBeNull();
    expect(sanitizeProfile({ ageYears: 131 }).ageYears).toBeNull();
    expect(sanitizeProfile({ egfr: -5 }).egfr).toBeNull();
    expect(sanitizeProfile({ egfr: 251 }).egfr).toBeNull();
    expect(sanitizeProfile({ crcl: -1 }).crcl).toBeNull();
    expect(sanitizeProfile({ crcl: 401 }).crcl).toBeNull();
    expect(sanitizeProfile({ qtc: 239 }).qtc).toBeNull(); // below the short-QT floor
    expect(sanitizeProfile({ qtc: -5 }).qtc).toBeNull();
    expect(sanitizeProfile({ qtc: 801 }).qtc).toBeNull();
  });

  it("applies serum-creatinine bounds by unit (µmol/L canonical, mg/dL normalised ×88.4)", () => {
    // µmol/L: inclusive [15, 3000].
    expect(sanitizeProfile({ scr: 15, scrUnit: "umol/L" }).scr).toBe(15);
    expect(sanitizeProfile({ scr: 3000, scrUnit: "umol/L" }).scr).toBe(3000);
    expect(sanitizeProfile({ scr: 14, scrUnit: "umol/L" }).scr).toBeNull();
    expect(sanitizeProfile({ scr: 3001, scrUnit: "umol/L" }).scr).toBeNull();
    expect(sanitizeProfile({ scr: -5, scrUnit: "umol/L" }).scr).toBeNull();
    // mg/dL: 0.3 (26.5 µmol/L) valid paediatric floor; 0.1 (8.84) too low; 40 (3536) too high.
    expect(sanitizeProfile({ scr: 0.3, scrUnit: "mg/dL" }).scr).toBe(0.3);
    expect(sanitizeProfile({ scr: 0.1, scrUnit: "mg/dL" }).scr).toBeNull();
    expect(sanitizeProfile({ scr: 40, scrUnit: "mg/dL" }).scr).toBeNull();
  });

  it("rejects non-finite and non-number inputs", () => {
    expect(sanitizeProfile({ egfr: "45" }).egfr).toBeNull();
    expect(sanitizeProfile({ egfr: Number.NaN }).egfr).toBeNull();
    expect(sanitizeProfile({ qtc: Number.POSITIVE_INFINITY }).qtc).toBeNull();
    expect(sanitizeProfile(null)).toMatchObject({ egfr: null, qtc: null });
  });

  it("exposes the verified bounds as named exports (validity, not clinical thresholds)", () => {
    expect(PATIENT_PROFILE_NUMERIC_BOUNDS.ageYears).toEqual({ min: 0, max: 130 });
    expect(PATIENT_PROFILE_NUMERIC_BOUNDS.egfr).toEqual({ min: 0, max: 250 });
    expect(PATIENT_PROFILE_NUMERIC_BOUNDS.crcl).toEqual({ min: 0, max: 400 });
    expect(PATIENT_PROFILE_NUMERIC_BOUNDS.qtc).toEqual({ min: 240, max: 800 });
    expect(PATIENT_PROFILE_SCR_UMOL_BOUNDS).toEqual({ min: 15, max: 3000 });
  });
});

function contraRecord(patient: MedicationPatientMetadata): MedicationRecord {
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
    sections: [{ title: "Contraindications", type: "contra", rows: [{ key: "Absolute", val: "row text", patient }] }],
  };
}

describe("sanitizeProfile + evaluatePatientAlerts — garbage input never becomes a false all-clear", () => {
  it("routes a garbage QTc to unassessed on a QTc contraindication instead of a silent clear", () => {
    const record = contraRecord({ factors: ["qtc"], action: "contraindication", match: { qtc: { gte: 450 } } });
    // Unsanitised, a negative QTc reads `-5 >= 450` as false → assessed-and-cleared.
    // Sanitised, it becomes null → surfaced as unassessed.
    const result = evaluatePatientAlerts(record, sanitizeProfile({ qtc: -5 }));
    expect(result.considerations).toHaveLength(0);
    expect(result.unassessed).toContain("QTc");
  });

  it("closes the bare-renal hole: out-of-range eGFR + present-normal CrCl → unassessed, not all-clear", () => {
    // The adversarially-found counterexample. Pre-fix, egfr -5 fired a nonsense
    // "Renal impairment (eGFR -5)". Null-routing alone would have produced a FALSE
    // ALL-CLEAR because CrCl 90 is present and non-firing; the engine's ||-guard
    // surfaces it as unassessed instead.
    const record = contraRecord({ factors: ["renal"], action: "contraindication", match: {} });
    const result = evaluatePatientAlerts(record, sanitizeProfile({ egfr: -5, crcl: 90 }));
    expect(result.considerations).toHaveLength(0);
    expect(result.unassessed).toContain("eGFR or CrCl");
  });

  it("preserves a real low eGFR so the contraindication still fires", () => {
    const record = contraRecord({ factors: ["renal"], action: "contraindication", match: { egfr: { lt: 30 } } });
    const result = evaluatePatientAlerts(record, sanitizeProfile({ egfr: 15 }));
    expect(result.considerations).toHaveLength(1);
    expect(result.considerations[0].reasons).toContain("eGFR 15 < 30 mL/min");
  });
});

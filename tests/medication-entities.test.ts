import { describe, expect, it } from "vitest";
import {
  hasForeignMedicationClinicalValueBinding,
  hasForeignMedicationEntity,
  isAntipsychoticMedicationEntity,
  medicationEntitiesInText,
} from "@/lib/medication-entities";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";

describe("medication entity safety catalogue", () => {
  it("recognizes every current medication snapshot record without loading the snapshot in RAG runtime code", () => {
    const missing = loadMedicationSnapshot()
      .filter((record) => medicationEntitiesInText(record.name).length === 0)
      .map((record) => record.name);

    expect(missing).toEqual([]);
  });

  it("canonicalizes formulations, brands, and equivalent names", () => {
    expect(medicationEntitiesInText("Lithium carbonate, Epilim, lignocaine and Zyprexa")).toEqual([
      "lithium",
      "valproate",
      "lidocaine",
      "olanzapine",
    ]);
  });

  it.each(["clozapine", "haloperidol", "olanzapine", "zuclopenthixol"])(
    "recognizes %s as an antipsychotic medication entity",
    (medication) => {
      expect(isAntipsychoticMedicationEntity(medication)).toBe(true);
    },
  );

  it("does not classify lithium as an antipsychotic medication entity", () => {
    expect(isAntipsychoticMedicationEntity("lithium")).toBe(false);
  });

  it.each(["digoxin", "methotrexate", "lamotrigine", "carbamazepine"])(
    "detects %s as foreign to a lithium query",
    (medication) => {
      expect(
        hasForeignMedicationEntity(
          "What lithium level range is used for maintenance monitoring?",
          `Unlike lithium, monitor ${medication} at 0.8 to 2.0 ng/mL.`,
        ),
      ).toBe(true);
    },
  );

  it("does not treat an equivalent lithium formulation as foreign", () => {
    expect(
      hasForeignMedicationEntity(
        "What lithium level range is used for maintenance monitoring?",
        "The maintenance range for lithium carbonate is 0.5 to 1.0 mmol/L.",
      ),
    ).toBe(false);
  });

  it("binds a clinical value to the nearest medication instead of vetoing contextual co-medications", () => {
    expect(
      hasForeignMedicationClinicalValueBinding(
        "What lithium level range is used for maintenance monitoring?",
        "Unlike lithium, monitor digoxin at 0.8 to 2.0 ng/mL.",
      ),
    ).toBe(true);
    expect(
      hasForeignMedicationClinicalValueBinding(
        "What lithium level range is used for maintenance monitoring?",
        "Maintain lithium at 0.6 to 0.8 mmol/L and keep sodium chloride intake stable.",
      ),
    ).toBe(false);
    expect(
      hasForeignMedicationClinicalValueBinding(
        "What lithium level range is used for maintenance monitoring?",
        "Maintain lithium at 0.6 to 0.8 mmol/L despite concurrent aspirin.",
      ),
    ).toBe(false);
    expect(
      hasForeignMedicationClinicalValueBinding(
        "What lithium level range is used for maintenance monitoring?",
        "For lithium co-prescribed with aspirin, maintain 0.6 to 0.8 mmol/L.",
      ),
    ).toBe(false);
    expect(
      hasForeignMedicationClinicalValueBinding(
        "What lithium level range is used for maintenance monitoring?",
        "For lithium, keep sodium chloride intake stable and maintain the level at 0.6 to 0.8 mmol/L.",
      ),
    ).toBe(false);
    expect(
      hasForeignMedicationClinicalValueBinding(
        "What lithium level range is used for maintenance monitoring?",
        "Maintain lithium at 0.6 to 0.8 mmol/L with aspirin co-prescribed.",
      ),
    ).toBe(false);
  });

  it("does not turn common vitamin monitoring language into a foreign-medication veto", () => {
    expect(
      hasForeignMedicationEntity(
        "What monitoring is required for lithium therapy?",
        "Lithium monitoring may include checking vitamin D when clinically indicated.",
      ),
    ).toBe(false);
  });
});

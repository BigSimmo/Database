import { describe, expect, it } from "vitest";

import {
  comparisonGuideFor,
  findFormulationMechanism,
  formulationDomains,
  formulationDraftFor,
  formulationMechanisms,
  formulationQualityPrompts,
  formulationSectionsForTemplate,
  formulationSourceLibrary,
  formulationTemplates,
  normalizeMechanismSelection,
  relatedFormulationMechanisms,
  searchFormulationMechanisms,
} from "@/lib/formulation";

describe("clinical formulation content", () => {
  it("loads the complete supplied formulation bundle", () => {
    expect(formulationMechanisms).toHaveLength(12);
    expect(formulationDomains).toHaveLength(12);
    expect(formulationTemplates).toHaveLength(6);
    expect(formulationQualityPrompts).toHaveLength(4);
    expect(Object.keys(formulationSourceLibrary)).toHaveLength(9);

    const ids = formulationMechanisms.map((mechanism) => mechanism.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const mechanism of formulationMechanisms) {
      expect(mechanism.name).toBeTruthy();
      expect(mechanism.definition).toBeTruthy();
      expect(mechanism.fitIndicators.length).toBeGreaterThan(0);
      expect(mechanism.poorFitIndicators.length).toBeGreaterThan(0);
      expect(mechanism.patientPhrases.length).toBeGreaterThan(0);
      expect(mechanism.treatmentLeverage).toBeTruthy();
    }
  });

  it("matches patient language and clinical clues to mechanisms", () => {
    expect(searchFormulationMechanisms("I keep going over it")[0]?.mechanism.id).toBe("rumination");
    expect(searchFormulationMechanisms("What if something goes wrong")[0]?.mechanism.id).toBe("worry");
    expect(searchFormulationMechanisms("It goes from zero to one hundred")[0]?.mechanism.id).toBe(
      "emotional-dysregulation",
    );
    expect(searchFormulationMechanisms("I was not really there")[0]?.mechanism.id).toBe("dissociation");
    expect(searchFormulationMechanisms("If it is not perfect it is a failure")[0]?.mechanism.id).toBe("perfectionism");
  });

  it("filters the mechanism catalogue by formulation domain", () => {
    const trauma = searchFormulationMechanisms("", { domain: "Trauma" });
    expect(trauma.length).toBeGreaterThan(0);
    expect(trauma.every(({ mechanism }) => mechanism.domains.includes("Trauma"))).toBe(true);

    const defence = searchFormulationMechanisms("", { domain: "Defence" });
    expect(defence.map(({ mechanism }) => mechanism.id)).toEqual(expect.arrayContaining(["splitting", "projection"]));
  });

  it("normalizes builder selections without inventing mechanisms", () => {
    expect(normalizeMechanismSelection(["rumination", "worry", "rumination", "missing"])).toEqual([
      "rumination",
      "worry",
    ]);
  });

  it("provides focused comparison guidance for close alternatives", () => {
    const guide = comparisonGuideFor("rumination", "worry");
    expect(guide?.assessmentQuestion).toContain("replaying what happened");
    expect(comparisonGuideFor("worry", "rumination")).toEqual(guide);

    const rumination = findFormulationMechanism("rumination");
    expect(rumination).toBeTruthy();
    expect(relatedFormulationMechanisms(rumination!)[0]?.id).toBe("worry");
  });

  it("maps each framework to populated formulation sections", () => {
    for (const template of formulationTemplates) {
      const sections = formulationSectionsForTemplate(template.id);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections.every((section) => section.group.includes(template.id))).toBe(true);
    }
    expect(formulationSectionsForTemplate("5Ps").map((section) => section.id)).toEqual(
      expect.arrayContaining(["presenting", "predisposing", "precipitating", "perpetuating", "protective"]),
    );
  });

  it("builds a reviewable draft from mechanisms, framework notes, and quality checks", () => {
    const rumination = findFormulationMechanism("rumination")!;
    const draft = formulationDraftFor({
      mechanisms: [rumination],
      templateId: "5Ps",
      notes: { presenting: "De-identified presenting pattern.", perpetuating: "Reviews perceived failures at night." },
      qualityNotes: { "quality-alternative": "Check worry and realistic problem solving." },
    });

    expect(draft).toContain("5Ps formulation");
    expect(draft).toContain("Working mechanism hypotheses");
    expect(draft).toContain(rumination.exampleSentence);
    expect(draft).toContain("Check worry and realistic problem solving.");
    expect(draft).toContain("Draft for clinical review");
  });
});

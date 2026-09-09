import { describe, expect, it } from "vitest";

import formulationContent from "@/data/formulation-content.json";
import {
  comparisonGuideFor,
  findFormulationMechanism,
  formulationDomains,
  formulationDraftFor,
  formulationMechanisms,
  formulationDomainsInUse,
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

  it("keeps release readiness separate from pending owner confirmation", () => {
    expect(formulationContent.governance.contentReviewSummary.pendingOwnerConfirmations).toBeGreaterThan(0);
    expect(formulationContent.governance.contentGovernance.confirmationNote).toMatch(/confirmation remains pending/i);
    expect(formulationContent.governance.contentGovernance.releaseStatus).not.toMatch(/^owner-confirmed/);
  });

  it("matches patient language and clinical clues to mechanisms", () => {
    expect(
      searchFormulationMechanisms("I keep going over it", { interpretNaturalLanguage: true })[0]?.mechanism.id,
    ).toBe("rumination");
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

  // docs/filter-contract.md: derive the option list from the data, never declare
  // it. The bundle declares 12 domains; Biological, Social and Cultural are
  // carried by none of the 12 mechanisms, so offering them meant three controls
  // that could never return anything — and under union counting an empty option
  // reports the unchanged total, so it looked identical to a full one.
  it("offers only the domains a mechanism actually carries", () => {
    expect(formulationDomains).toHaveLength(12);
    expect(formulationDomainsInUse).toHaveLength(9);
    expect(formulationDomainsInUse).not.toContain("Biological");
    expect(formulationDomainsInUse).not.toContain("Social");
    expect(formulationDomainsInUse).not.toContain("Cultural");
    for (const domain of formulationDomainsInUse) {
      expect(searchFormulationMechanisms("", { domains: new Set([domain]) }).length).toBeGreaterThan(0);
    }
    // Taxonomy order is preserved rather than re-sorted by count.
    expect(formulationDomainsInUse).toEqual(formulationDomains.filter((d) => formulationDomainsInUse.includes(d)));
  });

  // OR within the group. A mechanism carries 3.92 domains on average, so asking
  // for Affect OR Risk must widen — and must not double-count the overlap.
  it("combines domain facets as a union, never an intersection", () => {
    const affect = searchFormulationMechanisms("", { domains: new Set(["Affect"]) }).length;
    const risk = searchFormulationMechanisms("", { domains: new Set(["Risk"]) }).length;
    const both = searchFormulationMechanisms("", { domains: new Set(["Affect", "Risk"]) }).length;

    expect(affect).toBe(9);
    expect(risk).toBe(4);
    expect(both).toBe(10);
    expect(both).toBeGreaterThanOrEqual(Math.max(affect, risk));
    expect(both).toBeLessThan(affect + risk); // the overlap is real, not additive
    // An empty set imposes no constraint rather than matching nothing.
    expect(searchFormulationMechanisms("", { domains: new Set() })).toHaveLength(12);
  });

  // The count answers "how many would I have if I ticked this as well", which is
  // the same predicate as the filter. Narrowing the current subset instead would
  // disagree with what the click does, because adding an option widens.
  it("keeps every add-one-more count at or above the current total", () => {
    const selected = new Set(["Affect"]);
    const current = searchFormulationMechanisms("", { domains: selected }).length;
    for (const domain of formulationDomainsInUse) {
      const withCandidate = searchFormulationMechanisms("", { domains: new Set([...selected, domain]) }).length;
      expect(withCandidate).toBeGreaterThanOrEqual(current);
    }
    // Re-offering an already-selected option reports the unchanged total.
    expect(searchFormulationMechanisms("", { domains: new Set([...selected, "Affect"]) }).length).toBe(current);
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

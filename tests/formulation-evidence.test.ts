import { describe, expect, it } from "vitest";

import formulationContent from "@/data/formulation-content.json";
import {
  findFormulationMechanism,
  formulationDraftFor,
  formulationMechanisms,
  formulationSourceLibrary,
} from "@/lib/formulation";

/**
 * Safeguards the 2026-09-16 content update must not weaken. Two of them were
 * already missing before that update: per-mechanism caveats were held in the
 * data but rendered nowhere, and an empty builder produced a draft that read
 * like elicited case evidence.
 */
describe("formulation evidence and draft safeguards", () => {
  it("keeps every mechanism caveat and never drops the existing safeguards", () => {
    for (const mechanism of formulationMechanisms) {
      expect(mechanism.caveats.length).toBeGreaterThanOrEqual(3);
      expect(mechanism.caveats.some((caveat) => /hypothesis, not as a diagnosis/i.test(caveat))).toBe(true);
      expect(mechanism.caveats.some((caveat) => /alternative explanation/i.test(caveat))).toBe(true);
    }
  });

  it("keeps the alternatives the patch set could have overwritten", () => {
    const avoidance = findFormulationMechanism("avoidance")!;
    expect(avoidance.poorFitIndicators.length).toBeGreaterThanOrEqual(4);
    expect(avoidance.poorFitIndicators.some((item) => /low energy|fatigue/i.test(item))).toBe(true);
    expect(avoidance.poorFitIndicators.some((item) => /values-based boundary/i.test(item))).toBe(true);

    const reassurance = findFormulationMechanism("reassurance-seeking")!;
    expect(reassurance.treatmentImplications.length).toBeGreaterThanOrEqual(4);
  });

  it("labels a candidate maintaining process as a hypothesis to test", () => {
    const patched = ["avoidance", "worry", "rumination", "reassurance-seeking", "perfectionism"];
    for (const id of patched) {
      const mechanism = findFormulationMechanism(id)!;
      expect(mechanism.coreProcess).toMatch(/candidate maintaining process/i);
    }
  });

  it("never leaves raw markdown citations in a plain-text clinical field", () => {
    for (const mechanism of formulationMechanisms) {
      const text = [
        mechanism.definition,
        mechanism.summary,
        mechanism.coreProcess,
        mechanism.development,
        mechanism.caseExample,
        mechanism.treatmentTargetExample,
        mechanism.formulationUse,
        mechanism.exampleSentence,
        mechanism.treatmentLeverage,
        ...mechanism.caveats,
        ...mechanism.poorFitIndicators,
        ...mechanism.fitIndicators,
        ...mechanism.treatmentImplications,
      ].join(" ");
      expect(text).not.toMatch(/\[S\d{2}\]\(/);
      expect(text).not.toMatch(/\bS\d{2}\b/);
    }
  });

  it("resolves every mechanism evidence reference to a real source identity", () => {
    for (const mechanism of formulationMechanisms) {
      for (const sourceId of mechanism.sources) {
        expect(formulationSourceLibrary[sourceId]).toBeTruthy();
      }
      for (const evidence of mechanism.evidence) {
        expect(evidence.title).toBeTruthy();
        expect(evidence.relationship).toMatch(/^(direct_block_citation|record_context)$/);
        if (evidence.nativeSourceId) expect(formulationSourceLibrary[evidence.nativeSourceId]).toBeTruthy();
        if (!evidence.url) expect(evidence.urlStatus).not.toBe("governed");
      }
    }
  });

  it("does not present an empty formulation as elicited case evidence", () => {
    const draft = formulationDraftFor({
      mechanisms: [findFormulationMechanism("avoidance")!],
      templateId: "5Ps",
      notes: {},
      qualityNotes: {},
    });

    // Library prompts must never appear where a clinician has recorded nothing.
    expect(draft).not.toContain("High threat sensitivity");
    expect(draft).not.toContain("Trauma exposure");
    expect(draft).not.toContain("Missed appointments");
    expect(draft).toMatch(/no case evidence recorded/i);
  });

  it("keeps clinician-entered case evidence and marks library prompts as prompts", () => {
    const draft = formulationDraftFor({
      mechanisms: [findFormulationMechanism("avoidance")!],
      templateId: "5Ps",
      notes: { presenting: "De-identified presenting pattern.", perpetuating: "Cancels appointments after panic." },
      qualityNotes: {},
    });

    expect(draft).toContain("Cancels appointments after panic.");
    expect(draft).not.toContain("Short-term relief\n");
    expect(draft).toMatch(/Draft for clinical review/);
  });

  it("keeps release readiness pending and records the content update in the audit trail", () => {
    const governance = formulationContent.governance as {
      contentGovernance: { releaseStatus: string; confirmationNote: string; contentVersion: string };
    };
    expect(governance.contentGovernance.releaseStatus).not.toMatch(/^owner-confirmed/);
    expect(governance.contentGovernance.confirmationNote).toMatch(/confirmation remains pending/i);
    expect(governance.contentGovernance.contentVersion).toBe("Source review v2");
  });
});

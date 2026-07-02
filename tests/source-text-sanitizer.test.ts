import { describe, expect, it } from "vitest";
import {
  cleanClinicalSummaryText,
  clinicalProseUsefulness,
  isLowYieldClinicalText,
  lowYieldSourceNoiseScore,
  sourceTextForClinicalProse,
  sourceTextForDisplay,
  sourceTextForDocumentViewer,
  sourceTextForIndexedPage,
  sourceTextForModel,
} from "../src/lib/source-text-sanitizer";

describe("source text sanitizer", () => {
  it("removes complete and partial internal image metadata from display text", () => {
    const text =
      "Source mentions: [[IMAGE_DATA_START]] Image ID: img-1; Source kind: table_crop; Image type: clinical_table; Table text: | Dose | Route | [[IMAGE_DATA_END]] Continue oral medication when indicated.";

    const display = sourceTextForDisplay(text);

    expect(display).toBe("Continue oral medication when indicated.");
    expect(display).not.toContain("Source mentions:");
    expect(display).not.toContain("[[IMAGE_DATA_START]]");
    expect(display).not.toContain("Image ID:");
    expect(display).not.toContain("Table text:");
  });

  it("keeps readable image descriptions for model context without internal fields", () => {
    const text =
      "[[IMAGE_DATA_START]] Image ID: img-1; Source kind: table_crop; Table title: Agitation dose table; Table text: | Dose | Route |; Description: Oral and IM medication options. [[IMAGE_DATA_END]]";

    const modelText = sourceTextForModel(text);

    expect(modelText).toContain("Clinical table: Agitation dose table");
    expect(modelText).toContain("Oral and IM medication options");
    expect(modelText).not.toContain("Image ID:");
    expect(modelText).not.toContain("Source kind:");
    expect(modelText).not.toContain("[[IMAGE_DATA_START]]");
  });

  it("converts embedded table metadata into readable document-viewer text", () => {
    const text =
      "[[IMAGE_DATA_START]] Image ID: img-1; Source kind: table_crop; Image type: clinical_table; Table role: clinical; Table text: | Time since last Clozapine dose | Clozapine dose | Blood test monitoring || --- | --- | --- || <48 hours | Restart at normal dose of Clozapine | No changes to monitoring || ≥48 hours - ≤72 hours | Restart Clozapine at 12.5mg | No changes to monitoring |; Description: Table showing Clozapine dose adjustment and blood test monitoring protocol. [[IMAGE_DATA_END]]";

    const viewerText = sourceTextForDocumentViewer(text);

    expect(viewerText).toContain("Table showing Clozapine dose adjustment");
    expect(viewerText).toContain("Time since last Clozapine dose | Clozapine dose | Blood test monitoring");
    expect(viewerText).toContain(
      "- <48 hours: Clozapine dose: Restart at normal dose of Clozapine; Blood test monitoring: No changes to monitoring",
    );
    expect(viewerText).not.toContain("[[IMAGE_DATA_START]]");
    expect(viewerText).not.toContain("Image ID:");
    expect(viewerText).not.toContain("Source kind:");
    expect(viewerText).not.toContain("Table text:");
  });

  it("cleans generated clinical summaries while preserving safe markdown bold", () => {
    const summary =
      "Key practical points: **clozapine** monitoring is required. Source mentions: [[IMAGE_DATA_START]] Image ID: img-1; Source kind: table_crop; Table text: | Dose | [[IMAGE_DATA_END]]";

    const cleaned = cleanClinicalSummaryText(summary);

    expect(cleaned).toBe("**clozapine** monitoring is required.");
    expect(cleaned).not.toContain("Key practical points:");
    expect(cleaned).not.toContain("Source mentions:");
    expect(cleaned).not.toContain("[[IMAGE_DATA_START]]");
    expect(cleaned).not.toContain("Image ID:");
  });

  it("removes low-yield source codes and page boilerplate from clinical prose", () => {
    const text =
      "monitoring Neuroleptic side effect Guideline PAE-PRO-0338/16 Page 5 of 5. Dose evidence: effect profile of medication including the risk of PIS with Olanzapine LAI (1.85% of patients were affected in pre-marketing studies - refer to MIMS Product Information).";

    const cleaned = sourceTextForClinicalProse(text);

    expect(cleaned).toContain("effect profile of medication");
    expect(cleaned).not.toContain("Dose evidence");
    expect(cleaned).toContain("risk of PIS with Olanzapine LAI");
    expect(cleaned).not.toContain("PAE-PRO-0338");
    expect(cleaned).not.toContain("Page 5 of 5");
    expect(cleaned).not.toContain("refer to MIMS Product Information");
    expect(cleaned).not.toContain("Neuroleptic side effect Guideline");
  });

  it("removes standalone internal image classification tokens from clinical prose", () => {
    const text =
      "Table detailing roles and responsibilities for Clozapine monitoring. clinical_table table_crop Roles and responsibilities: discontinue therapy for red-range blood results.";

    const cleaned = sourceTextForClinicalProse(text);

    expect(cleaned).toContain("Clozapine monitoring");
    expect(cleaned).toContain("red-range blood results");
    expect(cleaned).not.toContain("clinical_table");
    expect(cleaned).not.toContain("table_crop");
  });

  it("marks source-title-heavy answer fragments as low usefulness while preserving clinical actions", () => {
    const noisy =
      "The retrieved medication/risk sources support these practical points. Dose evidence: LUNSERS (Liverpool University Neuroleptic Side Effect Rating Scale) - using for monitoring Neuroleptic side effect Guideline Appendix 1. Dose evidence: Care coordinator to follow up completion by consumer and report findings to treating doctor.";

    const usefulness = clinicalProseUsefulness(noisy);

    expect(usefulness.text).toContain("Care coordinator to follow up completion");
    expect(usefulness.text).not.toContain("Dose evidence");
    expect(usefulness.text).not.toContain("Liverpool University Neuroleptic Side Effect Rating Scale");
    expect(usefulness.text).not.toContain("The retrieved medication/risk sources");
    expect(usefulness.useful).toBe(true);
  });

  // H2 (audit 2026-07-01): a sentence carrying clinical threshold values must
  // survive even when it starts near a title keyword (Scale/Guideline/…) and
  // has no concrete-action verb — the greedy title-fragment match previously
  // deleted it wholesale.
  it("keeps threshold sentences that resemble source-title fragments (H2)", () => {
    const text =
      "Assess the patient on admission. The Glasgow Coma Scale ranges from 3 to 15 with 8 or below indicating severe head injury. Document the score.";

    const usefulness = clinicalProseUsefulness(text);

    expect(usefulness.text).toContain("ranges from 3 to 15");
    expect(usefulness.text).toContain("8 or below");
    expect(usefulness.text).toContain("Assess the patient on admission");
  });

  it("still drops bare-integer title noise like 'Guideline Appendix 1' (H2 guard)", () => {
    const noisy =
      "Dose evidence: LUNSERS (Liverpool University Neuroleptic Side Effect Rating Scale) - using for monitoring Neuroleptic side effect Guideline Appendix 1.";

    const usefulness = clinicalProseUsefulness(noisy);

    expect(usefulness.text).not.toContain("Liverpool University");
  });

  it("scores document-control snippets as low yield without hiding document viewer provenance", () => {
    const text = "Neuroleptic side effect Guideline PAE-PRO-0338/16 Page 5 of 5";

    expect(lowYieldSourceNoiseScore(text)).toBeGreaterThanOrEqual(0.45);
    expect(isLowYieldClinicalText(text)).toBe(true);
    expect(sourceTextForDocumentViewer(text)).toContain("PAE-PRO-0338/16");
    expect(sourceTextForDocumentViewer(text)).toContain("Page 5 of 5");
  });

  it("does not strip leading safe-bold markers during repeated summary cleaning", () => {
    const once = cleanClinicalSummaryText("Key practical points: **clozapine** monitoring is required.");

    expect(cleanClinicalSummaryText(once)).toBe("**clozapine** monitoring is required.");
  });

  it("preserves fixed-width indexed page spacing for table parsing", () => {
    const text =
      " Time since last Clozapine    Clozapine dose            Blood test monitoring\n dose\n\n <48 hours                     Restart at normal dose of     No changes to monitoring";

    const cleaned = sourceTextForIndexedPage(text);

    expect(cleaned).toContain("Clozapine    Clozapine dose");
    expect(cleaned).toContain("dose            Blood test monitoring");
  });
});

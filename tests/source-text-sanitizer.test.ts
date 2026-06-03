import { describe, expect, it } from "vitest";
import {
  cleanClinicalSummaryText,
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

    expect(display).toBe("Source mentions: Continue oral medication when indicated.");
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
    expect(viewerText).toContain("- <48 hours: Clozapine dose: Restart at normal dose of Clozapine; Blood test monitoring: No changes to monitoring");
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

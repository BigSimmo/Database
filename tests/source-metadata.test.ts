import { describe, expect, it } from "vitest";
import {
  clipboardProvenanceLine,
  formatClinicalDate,
  normalizeSourceMetadata,
  sourceProvenanceSummary,
  sourceStatusLabel,
  validationStatusLabel,
} from "../src/lib/source-metadata";

describe("source metadata helpers", () => {
  it("normalizes missing legacy metadata to explicit unknown labels without suppressing content", () => {
    const metadata = normalizeSourceMetadata(null);

    expect(metadata.document_status).toBe("unknown");
    expect(metadata.clinical_validation_status).toBe("unverified");
    expect(sourceStatusLabel(metadata)).toBe("Review status unknown");
    expect(validationStatusLabel(metadata)).toBe("Not locally validated");
    expect(sourceProvenanceSummary(metadata)).toContain("Review status unknown");
  });

  it("formats dates using Australian date order", () => {
    expect(formatClinicalDate("2026-05-18T10:00:00.000+08:00")).toBe("18/05/2026");
  });

  it("includes source status in copied provenance lines", () => {
    const line = clipboardProvenanceLine(
      normalizeSourceMetadata({
        document_status: "current",
        clinical_validation_status: "approved",
        review_date: "2026-05-18",
        jurisdiction: "Australia/WA",
      }),
    );

    expect(line).toContain("Review status: Current source");
    expect(line).toContain("Validation: Approved");
    expect(line).toContain("Review date: 18/05/2026");
  });

  it("keeps copied provenance explicit when review metadata is absent", () => {
    const line = clipboardProvenanceLine(null);

    expect(line).toContain("Review status: Review status unknown");
    expect(line).toContain("Validation: Not locally validated");
    expect(line).toContain("Review date: Unknown");
    expect(line).toContain("Jurisdiction: Unknown");
  });
});

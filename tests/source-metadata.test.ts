import { describe, expect, it, vi } from "vitest";
import { logger } from "../src/lib/logger";
import {
  clipboardProvenanceLine,
  formatClinicalDate,
  normalizeSourceMetadata,
  sourceProvenanceSummary,
  sourceStatusLabel,
  validationStatusLabel,
} from "../src/lib/source-metadata";
import { classifySourceAuthority } from "../src/lib/source-authority-registry";

describe("source metadata helpers", () => {
  it("normalizes missing legacy metadata to explicit unknown labels without suppressing content", () => {
    const metadata = normalizeSourceMetadata(null);

    expect(metadata.document_status).toBe("unknown");
    expect(metadata.clinical_validation_status).toBe("unverified");
    expect(sourceStatusLabel(metadata)).toBe("Review status unknown");
    expect(validationStatusLabel(metadata)).toBe("Not locally validated");
    expect(sourceProvenanceSummary(metadata)).toContain("Review status unknown");
  });

  it("traces unrecognized enum values via logger.warn while keeping the safe fallback, and stays silent for absent/blank inputs", () => {
    // Issue 1: a present-but-unrecognized value (data-entry typo) is traced via
    // logger.warn but must still coerce to the same safe fallback as before, so no
    // downstream ranking/rendering behaviour changes. Absent/blank inputs are the
    // legitimate default and must stay silent so the trace signal is not drowned.
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    try {
      const metadata = normalizeSourceMetadata({
        document_status: "revieww_due",
        clinical_validation_status: "aproved",
        extraction_quality: "gud",
      });

      // Return value is unchanged — the same safe fallbacks as before.
      expect(metadata.document_status).toBe("unknown");
      expect(metadata.clinical_validation_status).toBe("unverified");
      expect(metadata.extraction_quality).toBe("unknown");

      // Each unrecognized non-empty value is traced once, with its field + value.
      expect(warnSpy).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledWith("source-metadata: unrecognized document_status", {
        field: "document_status",
        value: "revieww_due",
      });
      expect(warnSpy).toHaveBeenCalledWith("source-metadata: unrecognized clinical_validation_status", {
        field: "clinical_validation_status",
        value: "aproved",
      });
      expect(warnSpy).toHaveBeenCalledWith("source-metadata: unrecognized extraction_quality", {
        field: "extraction_quality",
        value: "gud",
      });

      // Absent (null / undefined) and blank/whitespace values are the legitimate
      // default and never warn.
      warnSpy.mockClear();
      normalizeSourceMetadata(null);
      normalizeSourceMetadata({ document_status: "", clinical_validation_status: "   " });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
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
    expect(line).toContain("Jurisdiction: Australia/WA");
  });

  it("preserves registry route metadata during normalization", () => {
    const metadata = normalizeSourceMetadata({
      source_kind: "registry_record",
      registry_record_kind: "service",
      registry_record_subkind: null,
      registry_record_id: "svc-123",
      registry_record_slug: "perth-adult-mental-health",
      source_title: "Perth Adult Mental Health",
      document_status: "current",
      clinical_validation_status: "approved",
    });

    expect(metadata.registry_record_kind).toBe("service");
    expect(metadata.registry_record_subkind).toBeNull();
    expect(metadata.registry_record_id).toBe("svc-123");
    expect(metadata.registry_record_slug).toBe("perth-adult-mental-health");
  });

  it("preserves stale status labels for registry summaries", () => {
    const metadata = normalizeSourceMetadata({
      source_kind: "registry_record",
      document_status: "outdated",
      clinical_validation_status: "locally_reviewed",
    });

    expect(sourceStatusLabel(metadata)).toBe("Registry summary · Outdated source");
    expect(sourceProvenanceSummary(metadata)).toContain("Registry summary · Outdated source");
    expect(clipboardProvenanceLine(metadata)).toContain("Review status: Registry summary · Outdated source");
  });

  it("drops unknown filler segments but keeps governance warnings", () => {
    const emptySummary = sourceProvenanceSummary(normalizeSourceMetadata(null));

    // No "Publisher unknown · Jurisdiction unknown · review Unknown" filler —
    // only the clinical governance warnings remain visible. (The clipboard
    // line intentionally stays explicit; see the dedicated test below.)
    expect(emptySummary).toBe("Review status unknown · Not locally validated");

    const fullSummary = sourceProvenanceSummary(
      normalizeSourceMetadata({
        publisher: "WA Health",
        jurisdiction: "Australia/WA",
        review_date: "2026-05-18",
        document_status: "current",
        clinical_validation_status: "approved",
      }),
    );
    expect(fullSummary).toBe("WA Health · Australia/WA · review 18/05/2026 · Current source · Approved");
  });

  it("keeps copied provenance explicit when review metadata is absent", () => {
    const line = clipboardProvenanceLine(null);

    expect(line).toContain("Review status: Review status unknown");
    expect(line).toContain("Validation: Not locally validated");
    expect(line).toContain("Review date: Unknown");
    expect(line).toContain("Jurisdiction: Unknown");
  });
});

describe("source authority classification", () => {
  const usable = {
    document_status: "current",
    clinical_validation_status: "approved",
    extraction_quality: "good",
  } as const;

  it.each([
    {
      label: "known WA code",
      metadata: {
        ...usable,
        publisher_code: "FSH",
        publisher: "Fiona Stanley Hospital",
        jurisdiction: "Australia/WA",
      },
      tier: "wa_validated",
      matchedBy: "publisher_code",
    },
    {
      label: "generic WA Health alias",
      metadata: { ...usable, publisher: "WA Health", jurisdiction: "Western Australia" },
      tier: "wa_validated",
      matchedBy: "publisher_alias",
    },
    {
      label: "WA department alias",
      metadata: {
        ...usable,
        publisher: "Western Australian Department of Health",
        jurisdiction: "Australia/WA",
      },
      tier: "wa_validated",
      matchedBy: "publisher_alias",
    },
    {
      label: "WACHS alias with an unrecognised code",
      metadata: {
        ...usable,
        publisher_code: "LOCAL",
        publisher: "WA Country Health Service",
        jurisdiction: "Australia/WA",
      },
      tier: "wa_validated",
      matchedBy: "publisher_alias",
    },
    {
      label: "Australian national code",
      metadata: {
        ...usable,
        publisher_code: "TGA",
        publisher: "Therapeutic Goods Administration",
        jurisdiction: "Australia/National",
        clinical_validation_status: "unverified",
      },
      tier: "australian_national",
      matchedBy: "publisher_code",
    },
    {
      label: "Australian national alias",
      metadata: {
        ...usable,
        publisher: "Australian Commission on Safety and Quality in Healthcare",
        jurisdiction: "Commonwealth of Australia",
      },
      tier: "australian_national",
      matchedBy: "publisher_alias",
    },
    {
      label: "other Australian state authority",
      metadata: { ...usable, publisher: "NSW Health", jurisdiction: "Australia/NSW" },
      tier: "australian_state",
      matchedBy: "publisher_alias",
    },
    {
      label: "international source",
      metadata: {
        ...usable,
        publisher_code: "BMJ",
        publisher: "BMJ Best Practice",
        jurisdiction: "International",
      },
      tier: "supplementary",
      matchedBy: "publisher_code",
    },
  ])("classifies $label from exact metadata", ({ metadata, tier, matchedBy }) => {
    expect(classifySourceAuthority(metadata)).toMatchObject({ tier, matchedBy, conflict: false });
  });

  it.each([
    {
      label: "international code with WA jurisdiction",
      metadata: {
        ...usable,
        publisher_code: "BMJ",
        publisher: "BMJ Best Practice",
        jurisdiction: "Australia/WA",
      },
      conflicts: ["jurisdiction_mismatch"],
    },
    {
      label: "international code with a WA publisher and jurisdiction",
      metadata: { ...usable, publisher_code: "BMJ", publisher: "WA Health", jurisdiction: "Australia/WA" },
      conflicts: ["publisher_mismatch", "jurisdiction_mismatch"],
    },
    {
      label: "WA code with a conflicting known WA publisher",
      metadata: {
        ...usable,
        publisher_code: "FSH",
        publisher: "WA Country Health Service",
        jurisdiction: "Australia/WA",
      },
      conflicts: ["publisher_mismatch"],
    },
    {
      label: "trusted alias with an incompatible jurisdiction",
      metadata: { ...usable, publisher: "NSW Health", jurisdiction: "Australia/WA" },
      conflicts: ["jurisdiction_mismatch"],
    },
  ])("fails closed for $label", ({ metadata, conflicts }) => {
    const classification = classifySourceAuthority(metadata);

    expect(classification.tier).toBe("supplementary");
    expect(classification.conflict).toBe(true);
    expect(classification.conflicts).toEqual(conflicts);
  });

  it.each([
    {
      label: "jurisdiction without a trusted authority",
      metadata: { ...usable, jurisdiction: "Australia/WA" },
      reason: "unrecognized_authority",
    },
    {
      label: "authority text only in source title",
      metadata: {
        ...usable,
        source_title: "WA Country Health Service lithium guideline",
        jurisdiction: "Australia/WA",
      },
      reason: "unrecognized_authority",
    },
    {
      label: "publisher alias without jurisdiction",
      metadata: { ...usable, publisher: "WA Health" },
      reason: "publisher_alias_requires_jurisdiction",
    },
    {
      label: "review-due source",
      metadata: { ...usable, publisher_code: "WACHS", document_status: "review_due" },
      reason: "source_not_current_usable_document",
    },
    {
      label: "partial extraction",
      metadata: { ...usable, publisher_code: "WACHS", extraction_quality: "partial" },
      reason: "source_not_current_usable_document",
    },
    {
      label: "unvalidated WA source",
      metadata: { ...usable, publisher_code: "WACHS", clinical_validation_status: "unverified" },
      reason: "wa_source_not_locally_validated",
    },
  ])("does not promote $label", ({ metadata, reason }) => {
    const classification = classifySourceAuthority(metadata);

    expect(classification.tier).toBe("supplementary");
    expect(classification.eligibilityReasons).toContain(reason);
  });
});

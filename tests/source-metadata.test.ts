import { describe, expect, it, vi } from "vitest";
import {
  clipboardProvenanceLine,
  formatClinicalDate,
  hasRecordedGovernanceFields,
  normalizeClinicalSourceMetadata,
  normalizeOptionalSourceMetadata,
  normalizeSourceMetadata,
  sourceMetadataDiagnostics,
  sourceProvenanceSummary,
  sourceStatusLabel,
  validationStatusLabel,
} from "../src/lib/source-metadata";
import { classifySourceAuthority } from "../src/lib/source-authority-registry";

describe("source metadata helpers", () => {
  it("normalizes the canonical Australian policy metadata without inventing absent values", () => {
    const contentHash = "a".repeat(64);
    const metadata = normalizeClinicalSourceMetadata({
      corpus_scope: "australian_public",
      source_role: "clinical_guideline",
      content_mode: "indexed_content",
      source_catalogue_key: "wa-chief-psychiatrist",
      source_policy_version: "australian-source-policy-v1",
      canonical_url: "https://www.chiefpsychiatrist.wa.gov.au/guideline.pdf",
      effective_date: "2026-08-20",
      expiry_date: "2027-08-20T00:00:00.000Z",
      supersedes_document_id: "document-old",
      superseded_by_document_id: "document-next",
      retrieved_at: "2026-08-20T08:30:00+08:00",
      content_hash: contentHash,
      change_state: "unchanged",
      licence_policy: "public_index_permitted",
    });

    expect(metadata).toMatchObject({
      corpus_scope: "australian_public",
      source_role: "clinical_guideline",
      content_mode: "indexed_content",
      source_catalogue_key: "wa-chief-psychiatrist",
      source_policy_version: "australian-source-policy-v1",
      canonical_url: "https://www.chiefpsychiatrist.wa.gov.au/guideline.pdf",
      effective_date: "2026-08-20",
      expiry_date: "2027-08-20T00:00:00.000Z",
      supersedes_document_id: "document-old",
      superseded_by_document_id: "document-next",
      retrieved_at: "2026-08-20T08:30:00+08:00",
      content_hash: contentHash,
      change_state: "unchanged",
      licence_policy: "public_index_permitted",
    });

    expect(normalizeClinicalSourceMetadata(null)).toMatchObject({
      corpus_scope: null,
      source_role: null,
      content_mode: null,
      source_catalogue_key: null,
      source_policy_version: null,
      canonical_url: null,
      effective_date: null,
      expiry_date: null,
      supersedes_document_id: null,
      superseded_by_document_id: null,
      retrieved_at: null,
      content_hash: null,
      change_state: "unknown",
      licence_policy: null,
    });
  });

  it("fails malformed policy metadata closed with bounded diagnostics", () => {
    const warnSpy = vi.spyOn(sourceMetadataDiagnostics, "warn").mockImplementation(() => {});
    try {
      const urlSecret = "do-not-log-this-token";
      const metadata = normalizeClinicalSourceMetadata({
        corpus_scope: "public-ish",
        source_role: "treatment-advice",
        content_mode: "scraped_content",
        canonical_url: `https://clinical-user:clinical-password@example.test/path?token=${urlSecret}`,
        effective_date: "2026-02-30",
        expiry_date: "2026-02-30T00:00:00Z",
        retrieved_at: "2026-01-01T24:00:00Z",
        content_hash: "sha256:not-a-digest",
        change_state: "fresh",
        licence_policy: "probably-public",
      });

      expect(metadata).toMatchObject({
        corpus_scope: null,
        source_role: null,
        content_mode: null,
        canonical_url: null,
        effective_date: null,
        expiry_date: null,
        retrieved_at: null,
        content_hash: null,
        change_state: "unknown",
        licence_policy: null,
      });
      expect(warnSpy.mock.calls.map(([field]) => field)).toEqual(
        expect.arrayContaining([
          "corpus_scope",
          "source_role",
          "content_mode",
          "canonical_url",
          "effective_date",
          "expiry_date",
          "retrieved_at",
          "content_hash",
          "change_state",
          "licence_policy",
        ]),
      );
      expect(warnSpy.mock.calls).toEqual(
        expect.arrayContaining([
          [
            "canonical_url",
            expect.objectContaining({
              reason: "credentialed_url",
              input_type: "string",
              input_length: expect.any(Number),
            }),
          ],
          [
            "expiry_date",
            expect.objectContaining({ reason: "invalid_iso_date", input_type: "string", input_length: 20 }),
          ],
          [
            "retrieved_at",
            expect.objectContaining({ reason: "invalid_iso_date", input_type: "string", input_length: 20 }),
          ],
        ]),
      );
      const serializedDiagnostics = JSON.stringify(warnSpy.mock.calls);
      expect(serializedDiagnostics).not.toContain(urlSecret);
      expect(serializedDiagnostics).not.toContain("clinical-user");
      expect(serializedDiagnostics).not.toContain("clinical-password");
      expect(warnSpy.mock.calls.every((call) => JSON.stringify(call).length <= 200)).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("normalizes missing legacy metadata to explicit unknown labels without suppressing content", () => {
    const metadata = normalizeSourceMetadata(null);

    expect(metadata.document_status).toBe("unknown");
    expect(metadata.clinical_validation_status).toBe("unverified");
    expect(sourceStatusLabel(metadata)).toBe("Review status unknown");
    expect(validationStatusLabel(metadata)).toBe("Not locally validated");
    expect(sourceProvenanceSummary(metadata)).toContain("Review status unknown");
  });

  it("preserves empty and index-only metadata as unrecorded for optional normalization", () => {
    expect(hasRecordedGovernanceFields({})).toBe(false);
    expect(hasRecordedGovernanceFields({ index_generation_id: "gen-1" })).toBe(false);
    expect(hasRecordedGovernanceFields({ document_status: "   " })).toBe(false);
    expect(normalizeOptionalSourceMetadata(undefined)).toBeNull();
    expect(normalizeOptionalSourceMetadata(null)).toBeNull();
    expect(normalizeOptionalSourceMetadata({})).toBeNull();
    expect(normalizeOptionalSourceMetadata({ index_generation_id: "gen-1" })).toBeNull();
    expect(normalizeOptionalSourceMetadata({ clinical_validation_status: "unverified" })).toMatchObject({
      clinical_validation_status: "unverified",
    });
    expect(normalizeOptionalSourceMetadata({ document_status: "current" })).toMatchObject({
      document_status: "current",
      clinical_validation_status: "unknown",
      extraction_quality: "unknown",
    });
  });

  it("traces unrecognized enum values while keeping the safe fallback, and stays silent for absent/blank inputs", () => {
    // Issue 1: a present-but-unrecognized value (data-entry typo) is traced but must
    // still coerce to the same safe fallback as before, so no downstream
    // ranking/rendering behaviour changes. Absent/blank inputs are the legitimate
    // default and must stay silent so the trace signal is not drowned.
    // The trace goes through a browser-safe seam rather than the server logger: this
    // module renders client-side, and the logger's `process.env` read is a
    // ReferenceError in a browser.
    const warnSpy = vi.spyOn(sourceMetadataDiagnostics, "warn").mockImplementation(() => {});
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

      // Each unrecognized non-empty value is traced once without echoing its raw value.
      expect(warnSpy).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledWith("document_status", {
        reason: "unrecognized_enum",
        input_type: "string",
        input_length: 11,
      });
      expect(warnSpy).toHaveBeenCalledWith("clinical_validation_status", {
        reason: "unrecognized_enum",
        input_type: "string",
        input_length: 7,
      });
      expect(warnSpy).toHaveBeenCalledWith("extraction_quality", {
        reason: "unrecognized_enum",
        input_type: "string",
        input_length: 3,
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
      corpus_scope: "clinical_kb_site",
      source_role: "service_directory",
      document_status: "current",
      clinical_validation_status: "approved",
    });

    expect(metadata.registry_record_kind).toBe("service");
    expect(metadata.registry_record_subkind).toBeNull();
    expect(metadata.registry_record_id).toBe("svc-123");
    expect(metadata.registry_record_slug).toBe("perth-adult-mental-health");
    expect(metadata.corpus_scope).toBe("clinical_kb_site");
    expect(metadata.source_role).toBe("service_directory");
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
    ["HealthyWA", "HEALTHYWA", "HealthyWA", "Australia/WA", "wa_validated", "healthywa"],
    [
      "Mental Health Commission WA",
      "MHCWA",
      "Mental Health Commission WA",
      "Australia/WA",
      "wa_validated",
      "mental-health-commission-wa",
    ],
    [
      "Australian Institute of Health and Welfare",
      "AIHW",
      "Australian Institute of Health and Welfare",
      "Australia/National",
      "australian_national",
      "aihw",
    ],
    [
      "Australian Medicines Handbook",
      "AMH",
      "Australian Medicines Handbook",
      "Australia/National",
      "australian_national",
      "australian-medicines-handbook",
    ],
    [
      "Healthdirect Australia",
      "HEALTHDIRECT",
      "Healthdirect Australia",
      "Australia/National",
      "australian_national",
      "healthdirect-australia",
    ],
    [
      "Royal Australasian College of Physicians",
      "RACP",
      "Royal Australasian College of Physicians",
      "Australia/National",
      "australian_national",
      "racp",
    ],
    [
      "Therapeutic Guidelines",
      "TG",
      "Therapeutic Guidelines",
      "Australia/National",
      "australian_national",
      "therapeutic-guidelines",
    ],
    ["Cochrane", "COCHRANE", "Cochrane", "International", "supplementary", "cochrane"],
  ] as const)(
    "classifies registered %s from code-backed metadata",
    (label, publisherCode, publisher, jurisdiction, tier, authorityKey) => {
      // This would fail if a publisher were removed, assigned the wrong tier, or associated with a
      // different authority. The expected values are deliberately literal rather than derived from
      // the registry under test.
      expect(
        classifySourceAuthority({
          ...usable,
          publisher_code: publisherCode,
          publisher,
          jurisdiction,
        }),
      ).toMatchObject({ authorityKey, tier, matchedBy: "publisher_code", conflict: false });
    },
  );

  it.each([
    ["Healthy WA", "Australia/WA", "healthywa", "wa_validated"],
    ["Mental Health Commission Western Australia", "Australia/WA", "mental-health-commission-wa", "wa_validated"],
    [
      "Australian Medicines Handbook Pty Ltd",
      "Australia/National",
      "australian-medicines-handbook",
      "australian_national",
    ],
    ["healthdirect", "Australia/National", "healthdirect-australia", "australian_national"],
    ["Therapeutic Guidelines Ltd", "Australia/National", "therapeutic-guidelines", "australian_national"],
    ["Cochrane Library", "International", "cochrane", "supplementary"],
  ] as const)(
    "classifies registered %s from a jurisdiction-bound alias",
    (publisher, jurisdiction, authorityKey, tier) => {
      expect(classifySourceAuthority({ ...usable, publisher, jurisdiction })).toMatchObject({
        authorityKey,
        tier,
        matchedBy: "publisher_alias",
        conflict: false,
      });
    },
  );

  it("keeps catalogue-only Australian Prescriber out of runtime authority priority", () => {
    for (const publisherCode of ["AUSPRES", "AUSTPRESC"] as const) {
      expect(
        classifySourceAuthority({
          ...usable,
          publisher_code: publisherCode,
          publisher: "Australian Prescriber",
          jurisdiction: "Australia/National",
        }),
      ).toMatchObject({
        tier: "supplementary",
        designation: "unclassified",
        authorityKey: null,
        matchedBy: "none",
        codeKnown: false,
      });
    }
  });

  it("keeps an unvalidated HealthyWA source supplementary", () => {
    expect(
      classifySourceAuthority({
        ...usable,
        publisher_code: "HEALTHYWA",
        publisher: "HealthyWA",
        jurisdiction: "Australia/WA",
        clinical_validation_status: "unverified",
      }),
    ).toMatchObject({ tier: "supplementary", authorityKey: "healthywa" });
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

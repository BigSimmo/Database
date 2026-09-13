import { describe, expect, it } from "vitest";

import type { ClinicalSourceCatalogueEntry } from "@/lib/sources/catalogue-types";
import { sourceAttentionFlags, sourceProvenanceNotes } from "@/lib/sources/source-status-presentation";

function entry(overrides: Partial<ClinicalSourceCatalogueEntry> = {}): ClinicalSourceCatalogueEntry {
  return {
    id: "src_a",
    sourceId: "src_a",
    title: "A guideline",
    aliases: [],
    version: "1",
    publisher: "RANZCP",
    publisherCode: "RANZCP",
    sourceType: "guideline",
    canonicalLocation: { kind: "url", href: "https://example.org/a" },
    geography: { scope: "australian_national", label: "Australia" },
    topics: [],
    publicationDate: "2025-01-01",
    reviewDate: "2026-01-01",
    expiryDate: null,
    documentStatus: "current",
    validationStatus: "approved",
    contentMode: "link_only",
    lifecycleStatus: "active",
    supersedes: [],
    supersededBy: [],
    usedBy: [],
    rating: {
      score: 90,
      band: "A",
      weights: {
        accuracyAssurance: 25,
        reliability: 20,
        evidenceQuality: 20,
        currency: 15,
        australianApplicability: 15,
        traceability: 5,
      },
      dimensions: {
        accuracyAssurance: 25,
        reliability: 20,
        evidenceQuality: 20,
        currency: 15,
        australianApplicability: 10,
        traceability: 0,
      },
      reasons: [],
    },
    warnings: [],
    ...overrides,
  };
}

describe("sourceAttentionFlags", () => {
  it("stays silent for a current, active source", () => {
    expect(sourceAttentionFlags(entry())).toEqual([]);
  });

  it("reports currency, supersession and lifecycle as the states that change a decision", () => {
    expect(sourceAttentionFlags(entry({ documentStatus: "outdated" }))).toContainEqual({
      label: "Outdated",
      tone: "danger",
    });
    expect(sourceAttentionFlags(entry({ documentStatus: "review_due" }))).toContainEqual({
      label: "Review due",
      tone: "warning",
    });
    expect(sourceAttentionFlags(entry({ supersededBy: ["src_b"] }))).toContainEqual({
      label: "Superseded",
      tone: "danger",
    });
    expect(sourceAttentionFlags(entry({ lifecycleStatus: "excluded" }))).toContainEqual({
      label: "Excluded",
      tone: "danger",
    });
    expect(sourceAttentionFlags(entry({ lifecycleStatus: "inactive" }))).toContainEqual({
      label: "Inactive",
      tone: "warning",
    });
  });

  it("prefers the more serious of two currency or lifecycle states rather than listing both", () => {
    const flags = sourceAttentionFlags(entry({ documentStatus: "outdated", lifecycleStatus: "excluded" }));
    expect(flags.map((flag) => flag.label)).toEqual(["Outdated", "Excluded"]);
  });
});

describe("sourceProvenanceNotes", () => {
  it("says nothing about a source with clean provenance", () => {
    expect(sourceProvenanceNotes(entry())).toEqual([]);
  });

  it("names the provenance problem in clinical language, never as the stored code", () => {
    const notes = sourceProvenanceNotes(
      entry({ warnings: ["ambiguous_identity", "unsafe_location", "metadata_conflict"] }),
    );
    expect(notes).toEqual([
      "The source could not be identified with certainty",
      "The recorded link is not a verified secure location",
      "Recorded details about this source disagree with each other",
    ]);
    expect(notes.join(" ")).not.toMatch(/ambiguous_identity|unsafe_location|metadata_conflict/);
  });

  it("reports an unverified or unknown clinical validation status", () => {
    expect(sourceProvenanceNotes(entry({ validationStatus: "unverified" }))).toContain(
      "Marked as not yet clinically verified",
    );
    expect(sourceProvenanceNotes(entry({ validationStatus: "unknown" }))).toContain(
      "No clinical validation status was recorded",
    );
    expect(sourceProvenanceNotes(entry({ validationStatus: "locally_reviewed" }))).toEqual([]);
  });

  it("collapses the three missing-detail warnings into one note rather than repeating itself", () => {
    const notes = sourceProvenanceNotes(entry({ warnings: ["missing_publisher", "missing_version", "missing_dates"] }));
    expect(notes).toEqual(["Key record details are missing"]);
  });

  it("keeps currency and lifecycle out, because the flags already carry them", () => {
    expect(sourceProvenanceNotes(entry({ warnings: ["outdated", "superseded"] }))).toEqual([]);
  });
});

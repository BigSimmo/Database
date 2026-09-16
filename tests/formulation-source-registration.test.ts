import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  acquisitionLedgerIssues,
  acquisitionRecordWarnings,
  sourceAcquisitionRecords,
  type SourceAcquisitionRecord,
} from "@/lib/sources/acquisition-ledger";
import { canonicalizeSourceReferences } from "@/lib/sources/catalogue-core";
import { repositorySourceReferenceIssues, repositorySourceReferences } from "@/lib/sources/repository-providers";
import { publishedFormulationConcepts, publishedFormulationGuides } from "@/lib/formulation-concepts";

const formulationCaptures = sourceAcquisitionRecords.filter((record) => record.id.startsWith("formulation-"));

function ledgerRecord(id: string) {
  const record = sourceAcquisitionRecords.find((entry) => entry.id === id);
  if (!record) throw new Error(`missing ledger record ${id}`);
  return record;
}

/**
 * The 2026-09-16 Formulation handover proposed 55 source identities. Five of
 * them cleared the current native gates as metadata candidates; the rest stayed
 * held. These regressions pin that boundary so a later import cannot quietly
 * promote a held source or claim a review nobody performed.
 */
describe("formulation source registration", () => {
  it("registers exactly the five candidates that clear the current native gates", () => {
    expect(formulationCaptures.map((record) => record.id).sort()).toEqual([
      "formulation-ranzcp-cult",
      "formulation-ranzcp-oca",
      "formulation-ranzcp-suicide",
      "formulation-wa-ocp-risk",
      "formulation-who-cddr",
    ]);
  });

  it("keeps the whole ledger clean after the new captures", () => {
    expect(acquisitionLedgerIssues()).toEqual([]);
    for (const record of formulationCaptures) {
      expect(acquisitionRecordWarnings(record)).not.toContain("unsafe_location");
      expect(acquisitionRecordWarnings(record)).not.toContain("missing_version");
    }
  });

  it("never fabricates a clinical review for an imported candidate", () => {
    for (const record of formulationCaptures) {
      expect(record.disposition).toBe("candidate");
      expect(record.validationStatus).toBe("unverified");
      expect(record.contentMode).toBe("link_only");
      expect(record.reviewDate).toBeNull();
      expect(record.dispositionReason).toMatch(/metadata candidate only/i);
    }
  });

  it("records partial publisher dates at their true precision", () => {
    const oca = ledgerRecord("formulation-ranzcp-oca");
    expect(oca.datePrecision).toBe("month");
    expect(oca.publicationDate).toBe("2025-07-01");

    const who = ledgerRecord("formulation-who-cddr");
    expect(who.datePrecision).toBe("day");
    expect(who.publicationDate).toBe("2024-03-08");
  });

  it("keeps the WA risk standard separate from the existing clinical-care collection", () => {
    const risk = ledgerRecord("formulation-wa-ocp-risk");
    const collection = ledgerRecord("ocp-wa-standards-for-clinical-care");
    expect(risk.canonicalUrl).not.toBe(collection.canonicalUrl);
    expect(risk.rung).toBe(2);
    expect(collection.validationStatus).toBe("locally_reviewed");
  });

  it("preserves the nine native formulation source identities", () => {
    const formulationReferences = repositorySourceReferences().filter(
      (reference) => reference.usage.modeId === "formulation",
    );
    const ids = new Set(formulationReferences.map((reference) => reference.sourceId));
    for (const nativeId of [
      "cbt",
      "defense",
      "anxiety",
      "attachment",
      "dissociation",
      "emotion",
      "rumination",
      "shame",
      "perfectionism",
    ]) {
      expect(ids.has(nativeId)).toBe(true);
    }
    expect(repositorySourceReferenceIssues("formulation", formulationReferences)).toEqual([]);
  });

  it("projects concept citations as real record usage, never a placeholder", () => {
    const conceptReferences = repositorySourceReferences().filter(
      (reference) => reference.usage.modeId === "formulation" && reference.usage.field === "evidence",
    );
    expect(conceptReferences.length).toBeGreaterThan(0);
    const conceptIds = new Set(
      [...publishedFormulationConcepts, ...publishedFormulationGuides].map((record) => record.id),
    );
    for (const reference of conceptReferences) {
      expect(conceptIds.has(reference.usage.recordId)).toBe(true);
      expect(reference.usage.recordLabel).toBeTruthy();
      expect(reference.canonicalUrl).toMatch(/^https:\/\//);
      expect(reference.contentMode).toBe("link_only");
      expect(reference.validationStatus).not.toBe("approved");
    }
    const catalogued = canonicalizeSourceReferences(conceptReferences);
    expect(catalogued.length).toBeGreaterThan(0);
    for (const entry of catalogued) {
      expect(entry.canonicalLocation.kind).toBe("url");
      expect(entry.contentMode).toBe("link_only");
      expect(entry.usedBy.every((usage) => usage.modeId === "formulation")).toBe(true);
    }
  });

  it("does not register a held source as a ledger candidate", () => {
    const heldHosts = ["safetyandquality.gov.au", "oaic.gov.au", "link.springer.com", "frontiersin.org"];
    for (const record of sourceAcquisitionRecords as readonly SourceAcquisitionRecord[]) {
      for (const host of heldHosts) expect(record.canonicalUrl ?? "").not.toContain(host);
    }
  });
});

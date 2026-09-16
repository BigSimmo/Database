import { describe, expect, it } from "vitest";

import {
  acquisitionLedgerIssues,
  acquisitionRecordGeography,
  sourceAcquisitionRecords,
} from "@/lib/sources/acquisition-ledger";
import {
  sourceAuthorityForPublisher,
  sourceAuthorityIdentityForPublisher,
  sourceAuthorityIsRuntimeClassifiable,
  sourceAuthorityRegistry,
} from "@/lib/source-authority-registry";

/**
 * The DSM-5-TR handover supplied 24 sources. None could enter the acquisition
 * ledger because the American Psychiatric Association and the Independent Health
 * and Aged Care Pricing Authority were not in the source authority register, so
 * the catalogue could not place either in a jurisdiction.
 *
 * Registering a publisher is retrieval-sensitive, which is why these entries are
 * `catalogueIdentityOnly`. That flag is the whole safety argument: the entry
 * resolves a jurisdiction for the catalogue and the acquisition gate, and is
 * excluded by construction from the runtime classification path that steers
 * retrieval. The first test below is what holds that, and it must not be relaxed
 * without the retrieval evaluation the RAG safeguards require.
 */
const HANDOVER_IDENTITY_PUBLISHERS = [
  "American Psychiatric Association",
  "Independent Health and Aged Care Pricing Authority",
  "Substance Abuse and Mental Health Services Administration",
  "Government of Western Australia",
  "Specialty of Addiction Medicine, Faculty of Medicine and Health, The University of Sydney",
] as const;

describe("DSM-5-TR handover source authorities", () => {
  it("registers each supplied publisher for catalogue identity only", () => {
    for (const publisher of HANDOVER_IDENTITY_PUBLISHERS) {
      const identity = sourceAuthorityIdentityForPublisher(publisher);
      expect(identity, `${publisher} is not in the source authority register`).not.toBeNull();
      expect(identity!.catalogueIdentityOnly, `${publisher} must not be runtime classifiable`).toBe(true);
      expect(sourceAuthorityIsRuntimeClassifiable(identity!)).toBe(false);
    }
  });

  it("keeps every one of them out of the runtime classification path", () => {
    for (const publisher of HANDOVER_IDENTITY_PUBLISHERS) {
      expect(sourceAuthorityForPublisher(publisher)).toBeNull();
    }
  });

  it("places each publisher in the jurisdiction its own identity implies", () => {
    const scopeByPublisher = new Map(sourceAuthorityRegistry.map((entry) => [entry.publisher, entry.scope] as const));
    expect(scopeByPublisher.get("American Psychiatric Association")).toBe("international");
    expect(scopeByPublisher.get("Substance Abuse and Mental Health Services Administration")).toBe("international");
    expect(scopeByPublisher.get("Independent Health and Aged Care Pricing Authority")).toBe("australian_national");
    expect(scopeByPublisher.get("Government of Western Australia")).toBe("wa");
  });
});

describe("DSM-5-TR handover acquisition rows", () => {
  const admitted = [
    "apa-dsm5tr-supplement-2022-09",
    "apa-dsm5tr-supplement-2023-09",
    "apa-dsm5tr-supplement-2024-09",
    "apa-dsm5tr-supplement-2025-09",
    "apa-dsm5tr-manual",
    "ihacpa-icd10am-achi-acs-13",
    "sydney-alcohol-problems-guidelines-4",
  ] as const;

  it("admits exactly the supplied sources whose metadata was actually established", () => {
    const ids = new Set(sourceAcquisitionRecords.map((record) => record.id));
    for (const id of admitted) expect(ids.has(id), `${id} is missing from the ledger`).toBe(true);
  });

  it("keeps the whole ledger clean against the native gate", () => {
    expect(acquisitionLedgerIssues()).toEqual([]);
  });

  it("carries the printed date precision rather than inventing a publication day", () => {
    const byId = new Map(sourceAcquisitionRecords.map((record) => [record.id, record]));

    // "September 2025" on the supplement, not a day in September.
    const supplement = byId.get("apa-dsm5tr-supplement-2025-09")!;
    expect(supplement.datePrecision).toBe("month");
    expect(supplement.publicationDate).toBe("2025-09-01");

    // The manual is dated to a year by its own publisher.
    const manual = byId.get("apa-dsm5tr-manual")!;
    expect(manual.datePrecision).toBe("year");
    expect(manual.publicationDate).toBe("2022-01-01");

    // IHACPA prints an exact day, so precision stays day.
    const icd = byId.get("ihacpa-icd10am-achi-acs-13")!;
    expect(icd.datePrecision).toBe("day");
    expect(icd.publicationDate).toBe("2025-03-14");
  });

  it("files each row at the rung its publisher's geography implies", () => {
    const byId = new Map(sourceAcquisitionRecords.map((record) => [record.id, record]));
    expect(acquisitionRecordGeography(byId.get("apa-dsm5tr-manual")!)).toBe("international");
    expect(byId.get("apa-dsm5tr-manual")!.rung).toBe(5);
    expect(acquisitionRecordGeography(byId.get("ihacpa-icd10am-achi-acs-13")!)).toBe("australian_national");
    expect(byId.get("ihacpa-icd10am-achi-acs-13")!.rung).toBe(3);
  });

  it("leaves every admitted row unverified and never adopted", () => {
    const byId = new Map(sourceAcquisitionRecords.map((record) => [record.id, record]));
    for (const id of admitted) {
      const row = byId.get(id)!;
      expect(row.validationStatus, `${id} must not claim a review that has not happened`).toBe("unverified");
      expect(row.disposition, `${id} must not be adopted without clinical sign-off`).toBe("candidate");
    }
  });

  it("does not re-date the handover's 14 September capture as work done today", () => {
    const byId = new Map(sourceAcquisitionRecords.map((record) => [record.id, record]));
    for (const id of admitted) expect(byId.get(id)!.capturedAt).toBe("2026-09-14");
  });
});

import { describe, expect, it } from "vitest";

import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
import { medicationSourceLinkIds, medicationSourceLinks } from "@/lib/medication-source-links";
import {
  acquisitionAttestedContentSha256,
  sourceAcquisitionRecords,
  type SourceAcquisitionRecord,
} from "@/lib/sources/acquisition-ledger";

const TGA_CLOZAPINE_SEARCH = "https://www.ebs.tga.gov.au/ebs/picmi/picmirepository.nsf/PICMI?OpenForm&q=clozapine&t=pi";

function candidate(overrides: Partial<SourceAcquisitionRecord> = {}): SourceAcquisitionRecord {
  return {
    id: "fixture-clozapine-pi",
    title: "Australian Product Information: clozapine",
    publisher: "Therapeutic Goods Administration",
    publisherCode: "TGA",
    canonicalUrl: TGA_CLOZAPINE_SEARCH,
    jurisdiction: "Australia",
    version: "fixture version",
    publicationDate: "2026-01-01",
    datePrecision: "day",
    reviewDate: null,
    expiryDate: null,
    evidenceType: "regulatory",
    documentStatus: "current",
    validationStatus: "unverified",
    contentMode: "link_only",
    topics: ["Clozapine"],
    rung: 3,
    capturedAt: "2026-10-03",
    capturedFor: "fixture",
    disposition: "candidate",
    dispositionReason: "fixture",
    supersededBy: [],
    notes: null,
    ...overrides,
  };
}

/** Signs a fixture the way `npm run clinical:review -- --kind source` does: digest of the record as it stands. */
function signed(record: SourceAcquisitionRecord): SourceAcquisitionRecord {
  const reviewed = { ...record, validationStatus: "locally_reviewed" as const };
  return {
    ...reviewed,
    attestedBy: "Fixture Owner",
    attestedAt: "2026-10-03T00:00:00.000Z",
    attestedAgainstSha256: acquisitionAttestedContentSha256(reviewed),
  };
}

const links = { clozapine: ["fixture-clozapine-pi"] };

describe("medication source links", () => {
  it("maps only real medication slugs to real register records", () => {
    const slugs = new Set(loadMedicationSnapshot().map((record) => record.slug));
    const ids = new Set(sourceAcquisitionRecords.map((record) => record.id));
    for (const [slug, recordIds] of Object.entries(medicationSourceLinkIds)) {
      expect(slugs.has(slug), `unknown medication slug ${slug}`).toBe(true);
      for (const id of recordIds) expect(ids.has(id), `unknown register record ${id}`).toBe(true);
    }
  });

  it("shows nothing on the live pages until the owner signs the records off", () => {
    for (const slug of Object.keys(medicationSourceLinkIds)) {
      expect(medicationSourceLinks(slug)).toEqual([]);
    }
  });

  it("hides an unconfirmed record", () => {
    expect(medicationSourceLinks("clozapine", { links, records: [candidate()] })).toEqual([]);
  });

  it("hides a reviewed record that carries no attestation", () => {
    const reviewedOnly = candidate({ validationStatus: "locally_reviewed" });
    expect(medicationSourceLinks("clozapine", { links, records: [reviewedOnly] })).toEqual([]);
  });

  it("hides a record whose attestation is stale because content changed after sign-off", () => {
    const stale = { ...signed(candidate()), version: "corrected after sign-off" };
    expect(medicationSourceLinks("clozapine", { links, records: [stale] })).toEqual([]);
  });

  it("hides a rejected record even when it carries a matching attestation", () => {
    const rejected = signed(candidate({ disposition: "rejected" }));
    expect(medicationSourceLinks("clozapine", { links, records: [rejected] })).toEqual([]);
  });

  it("hides a confirmed record whose URL is not governed", () => {
    const ungoverned = signed(candidate({ canonicalUrl: "https://unreviewed-source.example/pi" }));
    expect(medicationSourceLinks("clozapine", { links, records: [ungoverned] })).toEqual([]);
  });

  it("returns a confirmed record as a link", () => {
    expect(medicationSourceLinks("clozapine", { links, records: [signed(candidate())] })).toEqual([
      {
        id: "fixture-clozapine-pi",
        title: "Australian Product Information: clozapine",
        publisher: "Therapeutic Goods Administration",
        href: TGA_CLOZAPINE_SEARCH,
      },
    ]);
    expect(medicationSourceLinks("lithium-carbonate-ir-sr", { links, records: [signed(candidate())] })).toEqual([]);
  });
});

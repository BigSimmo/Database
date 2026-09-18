import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  acquisitionLedgerIssues,
  acquisitionRecordGeography,
  type SourceAcquisitionRecord,
} from "@/lib/sources/acquisition-ledger";
import {
  sourceAuthorityForPublisher,
  sourceAuthorityIdentityForPublisher,
  sourceAuthorityIsRuntimeClassifiable,
  sourceAuthorityRegistry,
} from "@/lib/source-authority-registry";

/**
 * The 2026-09 Therapy and Services handovers named publishers the register could
 * not place, so `acquisitionLedgerIssues` refused every source they publish and
 * none could leave D band (ledger #RR3N4H and #YDENFM).
 *
 * This is the DSM-5-TR handover's precedent applied again, and the first test is
 * the whole safety argument: each entry resolves a jurisdiction for the catalogue
 * and the acquisition gate, and is excluded by construction from the runtime
 * classification that steers retrieval. It must not be relaxed without the
 * retrieval evaluation the RAG safeguards require.
 */
const HANDOVER_IDENTITY_PUBLISHERS = [
  "Centre for Clinical Interventions",
  "Phoenix Australia",
  "Monash University",
  "Department of Communities (WA)",
  "City of Vincent",
] as const;

const EXPECTED_SCOPES: Record<(typeof HANDOVER_IDENTITY_PUBLISHERS)[number], string> = {
  "Centre for Clinical Interventions": "wa",
  "Phoenix Australia": "australian_national",
  "Monash University": "australian_national",
  "Department of Communities (WA)": "wa",
  "City of Vincent": "wa",
};

describe("Therapy and Services handover source authorities", () => {
  it("registers each newly supplied publisher for catalogue identity only", () => {
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
    for (const publisher of HANDOVER_IDENTITY_PUBLISHERS) {
      expect(sourceAuthorityIdentityForPublisher(publisher)!.scope).toBe(EXPECTED_SCOPES[publisher]);
    }
  });

  it("resolves the names these publishers actually print on their own material", () => {
    const aliases = [
      ["Centre for Clinical Interventions (CCI)", "centre-for-clinical-interventions"],
      ["Phoenix Australia - Centre for Posttraumatic Mental Health", "phoenix-australia"],
      ["Australian Centre for Posttraumatic Mental Health", "phoenix-australia"],
      ["Department of Communities", "wa-department-of-communities"],
      // COPE was already registered under its plain name; the handover records copy
      // the masthead, which carries the acronym.
      ["COPE: Centre of Perinatal Excellence", "centre-of-perinatal-excellence"],
    ] as const;
    for (const [publisher, key] of aliases) {
      expect(sourceAuthorityIdentityForPublisher(publisher)?.key, `${publisher} did not resolve`).toBe(key);
    }
  });

  it("does not collide with an existing key or publisher code", () => {
    const keys = sourceAuthorityRegistry.map((entry) => entry.key);
    const newKeys = [
      "centre-for-clinical-interventions",
      "phoenix-australia",
      "monash-university",
      "wa-department-of-communities",
      "city-of-vincent",
    ];
    for (const key of newKeys) {
      expect(keys.filter((candidate) => candidate === key)).toHaveLength(1);
    }
    for (const code of ["CCI", "PHOENIXAU", "MONASH", "DOCWA", "VINCENT"]) {
      const owners = sourceAuthorityRegistry.filter((entry) => entry.codes.includes(code));
      expect(owners, `${code} must belong to exactly one authority`).toHaveLength(1);
      expect(owners[0]!.catalogueIdentityOnly).toBe(true);
    }
  });

  /**
   * The three publishers ledger #RR3N4H also named were already registered by the
   * 2026-09-16 Dictionary work. They are asserted here so the block is not
   * registered a second time under a different key.
   */
  it("leaves the three publishers already registered alone", () => {
    expect(sourceAuthorityIdentityForPublisher("Australasian ADHD Professionals Association")?.key).toBe(
      "australasian-adhd-professionals-association",
    );
    expect(sourceAuthorityIdentityForPublisher("Centre of Perinatal Excellence")?.key).toBe(
      "centre-of-perinatal-excellence",
    );
    // The department was renamed in 2025 and the older entry already carries the
    // new name as an alias, so it stays on that entry rather than gaining a second.
    expect(
      sourceAuthorityIdentityForPublisher("Australian Government Department of Health, Disability and Ageing")?.key,
    ).toBe("australian-department-of-health");
  });
});

const baseRecord: SourceAcquisitionRecord = {
  id: "cci-test-capture",
  title: "Test capture",
  publisher: "Centre for Clinical Interventions",
  publisherCode: "CCI",
  canonicalUrl: null,
  jurisdiction: "Australia/WA",
  version: "2026 edition",
  publicationDate: "2026-01-01",
  datePrecision: "year",
  reviewDate: null,
  expiryDate: null,
  evidenceType: "guideline",
  documentStatus: "current",
  validationStatus: "unverified",
  contentMode: "link_only",
  topics: [],
  rung: 2,
  capturedAt: "2026-09-18",
  capturedFor: "Registry test",
  disposition: "candidate",
  dispositionReason: "Awaiting sign-off",
  supersededBy: [],
  notes: null,
};

function record(overrides: Partial<SourceAcquisitionRecord> = {}): SourceAcquisitionRecord {
  return { ...baseRecord, ...overrides };
}

describe("the acquisition gate now admits sources from these publishers", () => {
  it("accepts a record from each newly registered publisher at its own rung", () => {
    const cases: [Partial<SourceAcquisitionRecord>, number][] = [
      [{ publisher: "Centre for Clinical Interventions", publisherCode: "CCI", jurisdiction: "Australia/WA" }, 2],
      [{ publisher: "Phoenix Australia", publisherCode: "PHOENIXAU", jurisdiction: "Australia" }, 3],
      [{ publisher: "Monash University", publisherCode: "MONASH", jurisdiction: "Australia" }, 3],
      [{ publisher: "Department of Communities (WA)", publisherCode: "DOCWA", jurisdiction: "Australia/WA" }, 2],
      [{ publisher: "City of Vincent", publisherCode: "VINCENT", jurisdiction: "Australia/WA" }, 1],
    ];
    for (const [overrides, rung] of cases) {
      const candidate = record({ ...overrides, rung: rung as SourceAcquisitionRecord["rung"] });
      expect(acquisitionLedgerIssues([candidate]), `${overrides.publisher} was refused`).toEqual([]);
    }
  });

  it("still derives the geography from the register rather than from the declared rung", () => {
    expect(acquisitionRecordGeography(record())).toBe("wa");
    expect(
      acquisitionRecordGeography(
        record({ publisher: "Phoenix Australia", publisherCode: "PHOENIXAU", jurisdiction: "Australia" }),
      ),
    ).toBe("australian_national");
  });

  it("refuses a record filed at a rung its publisher does not belong to", () => {
    const misfiled = record({
      publisher: "Phoenix Australia",
      publisherCode: "PHOENIXAU",
      jurisdiction: "Australia",
      rung: 2,
    });
    expect(acquisitionLedgerIssues([misfiled])).toEqual([
      "cci-test-capture: filed at rung 2 (expects wa) but the register places it in australian_national",
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { deriveGovernanceColumns } from "@/lib/registry-records";
import { deriveGovernanceFromSnapshot } from "@/lib/differential-records";
import { deriveGovernanceFromSections } from "@/lib/medication-records";
import type { ServiceRecord } from "@/lib/services";
import type { DifferentialSnapshot } from "@/lib/differential-snapshot";
import type { MedicationRecord } from "@/lib/medications";

describe("registry-records governance derivation", () => {
  const baseServiceRecord: ServiceRecord = {
    slug: "test-service",
    title: "Test Service",
    route: "http://example.com",
    source: {
      status: "checked 2026-06-30",
    },
  };

  it("derives current source status for verified checked sources", () => {
    const gov = deriveGovernanceColumns(baseServiceRecord);
    expect(gov.source_status).toBe("current");
    expect(gov.validation_status).toBe("unverified");
  });

  it("derives locally_reviewed validation status when verification is set", () => {
    const gov = deriveGovernanceColumns({
      ...baseServiceRecord,
      verification: { locallyVerified: true },
    });
    expect(gov.source_status).toBe("current");
    expect(gov.validation_status).toBe("locally_reviewed");
  });

  it("applies negative veto when source status contains 'not checked'", () => {
    const gov = deriveGovernanceColumns({
      ...baseServiceRecord,
      source: { status: "not checked 2026-06-30" },
    });
    expect(gov.source_status).toBe("unknown");
    expect(gov.validation_status).toBe("unverified");
  });

  it("applies negative veto when source status contains 'unchecked'", () => {
    const gov = deriveGovernanceColumns({
      ...baseServiceRecord,
      source: { status: "unchecked entry" },
    });
    expect(gov.source_status).toBe("unknown");
    expect(gov.validation_status).toBe("unverified");
  });

  it("applies negative veto when source status contains 'unverified'", () => {
    const gov = deriveGovernanceColumns({
      ...baseServiceRecord,
      source: { status: "unverified source" },
    });
    expect(gov.source_status).toBe("unknown");
    expect(gov.validation_status).toBe("unverified");
  });
});

describe("differential-records governance derivation", () => {
  const createMockSnapshot = (reviewStatus: string): DifferentialSnapshot => ({
    governance: {
      reviewStatus,
      version: "1.0",
      sourceTitle: "Test",
    },
    version: "1.0",
    exportedAt: "2026-06-30T00:00:00.000Z",
    presentations: [],
    diagnoses: [],
    presets: [],
    redFlagFlows: [],
    searchAliases: {},
  });

  it("defaults validation_status to unverified rather than locally_reviewed", () => {
    const snapshot = createMockSnapshot("checked 2026-06-30");
    const gov = deriveGovernanceFromSnapshot(snapshot);
    expect(gov.source_status).toBe("current");
    expect(gov.validation_status).toBe("unverified");
  });

  it("derives review_due when review status indicates pending", () => {
    const snapshot = createMockSnapshot("review pending 2026-06-30");
    const gov = deriveGovernanceFromSnapshot(snapshot);
    expect(gov.source_status).toBe("review_due");
    expect(gov.validation_status).toBe("unverified");
  });

  it("applies negative veto when review status contains 'not checked'", () => {
    const snapshot = createMockSnapshot("not checked 2026-06-30");
    const gov = deriveGovernanceFromSnapshot(snapshot);
    expect(gov.source_status).toBe("unknown");
    expect(gov.validation_status).toBe("unverified");
  });

  it("applies negative veto when review status contains 'unchecked'", () => {
    const snapshot = createMockSnapshot("unchecked draft");
    const gov = deriveGovernanceFromSnapshot(snapshot);
    expect(gov.source_status).toBe("unknown");
    expect(gov.validation_status).toBe("unverified");
  });

  it("applies negative veto when review status contains 'unverified'", () => {
    const snapshot = createMockSnapshot("unverified snapshot");
    const gov = deriveGovernanceFromSnapshot(snapshot);
    expect(gov.source_status).toBe("unknown");
    expect(gov.validation_status).toBe("unverified");
  });
});

describe("medication-records governance derivation negative veto", () => {
  const baseMedRecord: MedicationRecord = {
    slug: "test-veto-med",
    name: "Test Veto Med",
    class: "Test",
    subclass: "Test",
    category: "Test",
    accent: "#000000",
    tag: "TEST",
    schedule: "S4",
    stats: [],
    sections: [
      {
        title: "Sources",
        type: "src",
        rows: [{ key: "Review", val: "not checked 2026-06-30" }],
      },
    ],
    quick: [],
  };

  it("applies negative veto and reports unknown source_status for 'not checked'", () => {
    const gov = deriveGovernanceFromSections(baseMedRecord);
    expect(gov.source_status).toBe("unknown");
    expect(gov.validation_status).toBe("unverified");
  });

  it("applies negative veto and reports unknown source_status for 'unchecked'", () => {
    const med: MedicationRecord = {
      ...baseMedRecord,
      sections: [
        {
          title: "Sources",
          type: "src",
          rows: [{ key: "Review", val: "unchecked 2026-06-30" }],
        },
      ],
    };
    const gov = deriveGovernanceFromSections(med);
    expect(gov.source_status).toBe("unknown");
    expect(gov.validation_status).toBe("unverified");
  });
});

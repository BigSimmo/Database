import { describe, expect, it } from "vitest";

import { deriveGovernanceColumns } from "@/lib/registry-records";
import { parseRegistryListResponse, parseRegistryRecordResponse } from "@/lib/registry-client-contract";
import { getServiceRecord, serviceRecords } from "@/lib/services";

/** Mirrors the demo/public-access "full" list payload built by
 *  GET /api/registry/records (publicRegistryPayload + registryListPayload)
 *  against the real generated 227-record service catalogue, so this test
 *  fails if the client parser and the server's actual shape ever diverge. */
function buildFullListPayload() {
  const governance = Object.fromEntries(
    serviceRecords.map((record) => {
      const derived = deriveGovernanceColumns(record);
      return [record.slug, { sourceStatus: derived.source_status, validationStatus: derived.validation_status }];
    }),
  );
  return {
    records: serviceRecords,
    total: serviceRecords.length,
    verifiedCount: 0,
    governance,
    demoMode: true,
  };
}

/** Mirrors the demo/public-access detail payload built by
 *  GET /api/registry/records/[slug] (publicRegistryDetailPayload). */
function buildRecordPayload(slug: string) {
  const record = getServiceRecord(slug);
  if (!record) throw new Error(`Fixture service record not found: ${slug}`);
  const derived = deriveGovernanceColumns(record);
  return {
    record,
    governance: { sourceStatus: derived.source_status, validationStatus: derived.validation_status },
    linkedDocuments: [],
    demoMode: true,
  };
}

describe("registry-client-contract", () => {
  it("parses the real generated 227-record full-view service registry payload", () => {
    expect(serviceRecords.length).toBe(227);
    const payload = buildFullListPayload();
    const parsed = parseRegistryListResponse(payload, "full");
    expect(parsed).not.toBeNull();
    expect(parsed?.records.length).toBe(serviceRecords.length);
  });

  it("does not reject a record whose verification carries availabilityStatus and provenance fields", () => {
    // service-catalog-mapper always emits these sibling fields alongside
    // availabilityStatus; a record missing any of them from the parser's
    // allow-list must not make the whole list response parse as null.
    const withProvenance = serviceRecords.find(
      (record) =>
        record.verification?.availabilityStatus !== undefined &&
        record.verification?.lastVerifiedAt !== undefined &&
        record.verification?.unresolvedIssues !== undefined,
    );
    expect(withProvenance).toBeTruthy();

    const parsed = parseRegistryListResponse(buildFullListPayload(), "full");
    expect(parsed).not.toBeNull();
    const roundTripped = parsed?.records.find((record) => record.slug === withProvenance!.slug);
    expect(roundTripped?.verification?.availabilityStatus).toBe(withProvenance!.verification?.availabilityStatus);
  });

  it("parses a real generated service registry detail payload", () => {
    const slug = serviceRecords[0].slug;
    const payload = buildRecordPayload(slug);
    const parsed = parseRegistryRecordResponse(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.record.slug).toBe(slug);
  });

  it("parses every record in the generated catalogue individually through the detail parser", () => {
    for (const record of serviceRecords) {
      const parsed = parseRegistryRecordResponse(buildRecordPayload(record.slug));
      expect(parsed, `expected ${record.slug} to parse`).not.toBeNull();
    }
  });
});

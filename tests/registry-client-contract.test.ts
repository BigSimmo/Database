import { describe, expect, it } from "vitest";

import { deriveGovernanceColumns } from "@/lib/registry-records";
import { parseRegistryListResponse, parseRegistryRecordResponse } from "@/lib/registry-client-contract";
import { getServiceRecord, rankServiceRecords, serviceRecords } from "@/lib/services";

/** Mirrors the demo/public-access "full" list payload built by
 *  GET /api/registry/records (publicRegistryPayload + registryListPayload)
 *  against the real generated 244-record service catalogue, so this test
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

/** Mirrors the same payload for a request that carries `q`, which is the only
 *  thing that makes the route emit `matches` — the shape that used to make the
 *  whole response unparseable. Compact records, exactly as the search view sends. */
function buildSearchListPayload() {
  const records = serviceRecords.slice(0, 20);
  const matches = rankServiceRecords(records, "clinic", 10, [], true);
  return {
    records: records.map((record) => ({
      slug: record.slug,
      title: record.title,
      subtitle: record.subtitle,
      route: record.route,
      statusChips: record.statusChips,
      primaryContact: record.primaryContact,
      tags: record.tags,
      catchments: record.catchments,
    })),
    matches: matches.map((match) => ({
      record: {
        slug: match.service.slug,
        title: match.service.title,
        subtitle: match.service.subtitle,
        route: match.service.route,
        statusChips: match.service.statusChips,
        primaryContact: match.service.primaryContact,
        tags: match.service.tags,
        catchments: match.service.catchments,
      },
      score: match.score,
      reasons: match.reasons,
    })),
    total: records.length,
    verifiedCount: 0,
    publicAccess: true,
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
  it("parses the real generated 244-record full-view service registry payload", () => {
    expect(serviceRecords.length).toBe(244);
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

  it("parses a search-view list payload that carries ranked matches", () => {
    // Regression: `matches` is emitted by the route for any non-summary view once `q` is
    // present, and it was missing from the allow-list. The parser returned null, and the
    // client reports null as "the registry could not be searched" — a broken search surface
    // for a response that was completely valid.
    const payload = buildSearchListPayload();
    expect(payload.matches.length).toBeGreaterThan(0);
    const parsed = parseRegistryListResponse(payload, "search");
    expect(parsed).not.toBeNull();
    expect(parsed?.records.length).toBe(payload.records.length);
  });

  it("parses a full-view list payload that carries ranked matches", () => {
    const payload = { ...buildFullListPayload(), matches: buildSearchListPayload().matches };
    expect(parseRegistryListResponse(payload, "full")).not.toBeNull();
  });

  it("still rejects a list payload carrying a key the route never emits", () => {
    const payload = { ...buildFullListPayload(), unexpectedKey: true };
    expect(parseRegistryListResponse(payload, "full")).toBeNull();
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

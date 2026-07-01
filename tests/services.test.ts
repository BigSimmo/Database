import { describe, expect, it } from "vitest";

import {
  defaultServiceSlug,
  getServiceRecord,
  searchServiceRecords,
  serviceNavigatorQuery,
  serviceRecordSearchText,
  serviceRecords,
  serviceStaticParams,
} from "@/lib/services";

describe("service records", () => {
  it("exposes the mockup service set as reusable records", () => {
    expect(serviceRecords.map((service) => service.slug)).toEqual([
      "13yarn",
      "mental-health-emergency-response-line",
      "rurallink",
      "head-to-health",
      "wachs-aboriginal-mental-health",
    ]);
  });

  it("keeps each service renderable from real record fields", () => {
    for (const service of serviceRecords) {
      expect(service.slug).toBeTruthy();
      expect(service.title).toBeTruthy();
      expect(serviceNavigatorQuery(service)).toBeTruthy();
      expect(service.referralInfo?.length ?? service.primaryContact?.value).toBeTruthy();
      expect(service.primaryContact?.value).toBeTruthy();
      expect(service.route ?? service.summaryCards?.find((row) => row.id === "route")?.title).toBeTruthy();
      expect(service.eligibility ?? service.summaryCards?.find((row) => row.id === "eligibility")?.title).toBeTruthy();
      expect(service.cost ?? service.summaryCards?.find((row) => row.id === "cost")?.title).toBeTruthy();
      expect(service.criteria?.length).toBeGreaterThan(0);
      expect(service.verification?.confidence).toBeTruthy();
      expect(service.tags?.length || service.catchments?.length).toBeTruthy();
    }
  });

  it("keeps seeded service records source-backed rather than placeholder copy", () => {
    for (const service of serviceRecords) {
      const searchableText = JSON.stringify(service).toLowerCase();

      expect(searchableText).not.toContain("placeholder");
      expect(searchableText).not.toContain("source url missing");
      expect(service.source?.url).toMatch(/^https:\/\/.+/);
      expect(service.source?.status).not.toMatch(/needs source review/i);
      expect(service.catalogueLabel).not.toMatch(/placeholder/i);
    }
  });

  it("normalizes service lookup and static params", () => {
    expect(defaultServiceSlug()).toBe("13yarn");
    expect(getServiceRecord(" 13YARN ")?.title).toBe("13YARN");
    expect(getServiceRecord("missing-service")).toBeNull();
    expect(serviceStaticParams()).toEqual(serviceRecords.map((service) => ({ slug: service.slug })));
  });

  it("searches real service records for services mode", () => {
    expect(serviceRecordSearchText(serviceRecords[0])).toContain("13yarn");
    expect(searchServiceRecords("13YARN")[0]?.service.slug).toBe("13yarn");
    expect(searchServiceRecords("139276")[0]?.service.slug).toBe("13yarn");
    expect(searchServiceRecords("services")).toHaveLength(serviceRecords.length);
    expect(searchServiceRecords("forms")).toHaveLength(0);
    expect(searchServiceRecords("Great Southern Aboriginal")[0]?.service.slug).toBe(
      "wachs-aboriginal-mental-health",
    );
  });
});

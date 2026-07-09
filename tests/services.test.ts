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
  it("loads the full WA services catalogue", () => {
    expect(serviceRecords.length).toBe(219);
    expect(serviceRecords.some((service) => service.slug === "13yarn")).toBe(true);
  });

  it("keeps each service renderable from real record fields", () => {
    for (const service of serviceRecords) {
      expect(service.slug).toBeTruthy();
      expect(service.title).toBeTruthy();
      expect(serviceNavigatorQuery(service)).toBeTruthy();
      expect(service.referralInfo?.length ?? service.primaryContact?.value).toBeTruthy();
      expect(service.route ?? service.summaryCards?.find((row) => row.id === "route")?.title).toBeTruthy();
      expect(service.eligibility ?? service.summaryCards?.find((row) => row.id === "eligibility")?.title).toBeTruthy();
      expect(service.cost ?? service.summaryCards?.find((row) => row.id === "cost")?.title).toBeTruthy();
      expect(service.criteria?.length).toBeGreaterThan(0);
      expect(service.verification?.confidence).toBeTruthy();
      expect(service.tags?.length || service.catchments?.length).toBeTruthy();
    }
  });

  it("normalizes service lookup and static params", () => {
    expect(defaultServiceSlug()).toBeTruthy();
    expect(getServiceRecord(" 13YARN ")?.title).toBe("13YARN");
    expect(getServiceRecord("missing-service")).toBeNull();
    expect(serviceStaticParams()).toHaveLength(serviceRecords.length);
  });

  it("searches real service records for services mode", () => {
    const yarn = serviceRecords.find((service) => service.slug === "13yarn");
    expect(yarn).toBeTruthy();
    expect(serviceRecordSearchText(yarn!)).toContain("13yarn");
    expect(searchServiceRecords("13YARN")[0]?.service.slug).toBe("13yarn");
    expect(searchServiceRecords("139276")[0]?.service.slug).toBe("13yarn");
    expect(searchServiceRecords("services")).toHaveLength(serviceRecords.length);
    expect(searchServiceRecords("forms").length).toBeLessThan(serviceRecords.length);
  });
});

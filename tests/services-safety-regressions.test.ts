import { describe, expect, it } from "vitest";

import { catalogToServiceRecord } from "@/lib/service-catalog-mapper";
import { loadServicesSnapshot, type CatalogService } from "@/lib/service-catalog";

describe("services safety regressions", () => {
  it("never turns a crisis service into a non-crisis rejection", () => {
    const yarn = loadServicesSnapshot().services.find((service) => service.canonical_name_key === "13yarn");
    expect(yarn).toBeDefined();

    const record = catalogToServiceRecord(yarn!);
    expect(record.criteria?.some((criterion) => criterion.label === "Non-crisis routine referral only")).toBe(false);
  });

  it("does not call an unsourced record source checked", () => {
    const yarn = loadServicesSnapshot().services.find((service) => service.canonical_name_key === "13yarn");
    expect(yarn).toBeDefined();

    const unsourced: CatalogService = {
      ...yarn!,
      confidence: "High",
      public_source_urls: [],
      verification_flags: [],
      web_review_status: "",
    };

    const record = catalogToServiceRecord(unsourced);
    expect(record.source?.status).not.toBe("Source checked");
  });
});

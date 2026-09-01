import { describe, expect, it } from "vitest";

import { catalogToServiceRecord } from "@/lib/service-catalog-mapper";
import { loadServicesSnapshot, normalizeCatalogService, type CatalogService } from "@/lib/service-catalog";

describe("services safety regressions", () => {
  it("loads the committed canonical records into the services snapshot", () => {
    const emergencyServices = loadServicesSnapshot().services.find((service) => service.name === "Emergency services");

    expect(emergencyServices).toBeDefined();
    expect(emergencyServices?.public_source_urls).toContain(
      "https://www.mhc.wa.gov.au/getting-help/your-health-and-wellbeing/suicide",
    );
  });

  it("retains canonical governance fields when normalising a catalogue record", () => {
    const service = normalizeCatalogService(
      {
        id: "SVC-TEST-001",
        name: "Governed service",
        stable_id: "SVC-TEST-001",
        aliases: ["Governed alias"],
        tags: { availability_flags: ["active"] },
        availability_status: "active",
        evidence_sources: [
          {
            sourceId: "SRC-TEST-001",
            title: "Official source",
            issuer: "Test issuer",
            sourceClass: "Tier 1",
            jurisdiction: "Western Australia",
            publicationOrEffectiveDate: "2026-08-23",
            url: "https://example.test/source",
            accessedAt: "2026-08-23",
          },
        ],
      },
      0,
    );

    expect(service).toMatchObject({
      stable_id: "SVC-TEST-001",
      aliases: ["Governed alias"],
      tags: { availability_flags: ["active"] },
      availability_status: "active",
      evidence_sources: [{ sourceId: "SRC-TEST-001" }],
    });
  });
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

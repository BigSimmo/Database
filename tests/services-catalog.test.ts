import { describe, expect, it } from "vitest";

import { catalogToServiceRecord, mapCatalogToServiceRecords } from "@/lib/service-catalog-mapper";
import { loadServicesSnapshot, normalizeCatalogServices } from "@/lib/service-catalog";
import {
  getServiceRecord,
  loadServiceRecords,
  rankServiceRecords,
  searchServiceRecords,
  serviceRecords,
} from "@/lib/services";

describe("services catalogue", () => {
  it("loads 219 services from snapshot", () => {
    const snapshot = loadServicesSnapshot();
    expect(snapshot.service_count).toBe(219);
    expect(snapshot.services).toHaveLength(219);
    expect(serviceRecords).toHaveLength(219);
    expect(loadServiceRecords()).toHaveLength(219);
  });

  it("maps 13yarn with phone and medium confidence", () => {
    const snapshot = loadServicesSnapshot();
    const yarn = snapshot.services.find((service) => service.canonical_name_key === "13yarn");
    expect(yarn).toBeTruthy();

    const record = catalogToServiceRecord(yarn!);
    expect(record.slug).toBe("13yarn");
    expect(record.title).toBe("13YARN");
    expect(record.primaryContact?.value).toContain("13 92 76");
    expect(record.verification?.confidence).toBe("Medium");
  });

  it("compacts pipe-joined best-use blobs on summary cards", () => {
    const snapshot = loadServicesSnapshot();
    const crisisCare = snapshot.services.find((service) => service.canonical_name_key === "crisis-care");
    expect(crisisCare?.best_use_indication?.includes("|")).toBe(true);
    expect(crisisCare!.best_use_indication.length).toBeGreaterThan(140);

    const record = catalogToServiceRecord(crisisCare!);
    const bestUseCard = record.summaryCards?.find((card) => card.id === "best-use");
    expect(bestUseCard?.title).toBe("After-hours crisis, homelessness, FDV, child-safety concerns");
    expect(record.criteria?.some((criterion) => criterion.label === crisisCare!.best_use_indication)).toBe(true);
  });

  it("produces unique slugs and non-empty titles", () => {
    const records = mapCatalogToServiceRecords(loadServicesSnapshot().services);
    const slugs = records.map((record) => record.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(records.every((record) => record.title.trim().length > 0)).toBe(true);
  });

  it("ranks 13YARN for crisis query", () => {
    const records = loadServiceRecords();
    const matches = rankServiceRecords(records, "13YARN crisis support", 10);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.service.slug).toBe("13yarn");
    expect(searchServiceRecords("13YARN")[0]?.service.slug).toBe("13yarn");
  });

  it("normalizes service lookup", () => {
    expect(getServiceRecord(" 13YARN ")?.title).toBe("13YARN");
    expect(getServiceRecord("missing-service")).toBeNull();
  });

  it("normalizes raw catalog services consistently", () => {
    const snapshot = loadServicesSnapshot();
    const normalized = normalizeCatalogServices(snapshot);
    expect(normalized).toHaveLength(219);
    expect(normalized[0]?.id).toMatch(/^S\d{3}$/);
  });
});

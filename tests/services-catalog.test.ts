import { describe, expect, it } from "vitest";

import { compactBestUseTitle, compactCatalogField, parseLabeledReferralDetails } from "@/lib/compact-best-use-title";
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
    expect(bestUseCard?.title?.length).toBeLessThanOrEqual(120);
    expect(bestUseCard?.title?.includes("|")).toBe(false);
    expect(record.criteria?.some((criterion) => criterion.label.includes("|"))).toBe(false);
    expect(
      record.criteria?.some(
        (criterion) => criterion.label === "After-hours crisis, homelessness, FDV, child-safety concerns",
      ),
    ).toBe(true);
  });

  it("compacts route, eligibility, cost, and referral rows without pipe joins", () => {
    const snapshot = loadServicesSnapshot();
    const cads = snapshot.services.find(
      (service) => service.canonical_name_key === "community-alcohol-and-drug-services-cads-network",
    );
    expect(cads?.referral_details.includes("|")).toBe(true);
    expect(cads?.best_use_indication.includes("|")).toBe(true);

    const record = catalogToServiceRecord(cads!);
    expect(record.route).toBe("Self-referral accepted; clinician referral form available");
    expect(record.route).not.toContain("|");
    expect(record.eligibility).not.toContain("|");
    expect(record.cost).toBe("Free/confidential");
    expect(record.bestUse).not.toContain("|");
    expect(record.subtitle).not.toContain("|");

    const primaryRoute = record.referralInfo?.find((row) => row.label === "Primary route");
    expect(primaryRoute?.value).toBe("Self-referral accepted; clinician referral form available");
    expect(primaryRoute?.value).not.toEqual(cads!.referral_details);
    expect(primaryRoute?.value).not.toContain("|");
    expect(record.referralInfo?.every((row) => !row.value?.includes("|"))).toBe(true);
  });

  it("parses labeled referral_details into discrete pathway/hours/cost parts", () => {
    const parsed = parseLabeledReferralDetails(
      "Contact: 13 92 76 | Referral pathway: Self phone referral | Hours: 24/7 | Cost/funding: Free",
    );
    expect(parsed.pathway).toBe("Self phone referral");
    expect(parsed.hours).toBe("24/7");
    expect(parsed.cost).toBe("Free");
    expect(parsed.contact).toBe("13 92 76");
  });

  it("prefers informative pathway clauses over short tokens like Phone", () => {
    expect(compactCatalogField("Phone | Self, clinician, carer by phone | Self or clinician by phone")).toBe(
      "Self, clinician, carer by phone",
    );
  });

  it("ranks actionable clauses above qualified placeholders for S018 and S081", () => {
    const snapshot = loadServicesSnapshot();
    const cci = snapshot.services.find((service) => service.id === "S018");
    const karaMaar = snapshot.services.find((service) => service.id === "S081");
    expect(cci).toBeTruthy();
    expect(karaMaar).toBeTruthy();

    const cciRecord = catalogToServiceRecord(cci!);
    expect(cciRecord.route).toBe("Contact service; external referral forms and inclusion/exclusion criteria");
    expect(cciRecord.route?.toLowerCase()).not.toContain("not publicly stated");
    expect(cciRecord.criteria?.some((criterion) => /not publicly stated/i.test(criterion.label))).toBe(false);
    expect(
      cciRecord.criteria?.some(
        (criterion) =>
          criterion.tone === "meet" &&
          criterion.label.includes("Contact service; external referral forms and inclusion/exclusion criteria"),
      ),
    ).toBe(true);

    const karaRecord = catalogToServiceRecord(karaMaar!);
    expect(karaRecord.criteria?.some((criterion) => criterion.label === "Not publicly stated in public summary")).toBe(
      false,
    );
    expect(
      karaRecord.criteria?.some(
        (criterion) =>
          criterion.tone === "reject" && /Must fit specialist community ED service model/i.test(criterion.label),
      ),
    ).toBe(true);
  });

  it("compacts raw best-use fallbacks for stale seeded summary cards", () => {
    const snapshot = loadServicesSnapshot();
    const crisisCare = snapshot.services.find((service) => service.canonical_name_key === "crisis-care");
    expect(crisisCare).toBeTruthy();

    const compacted = compactBestUseTitle(crisisCare!.best_use_indication);
    expect(compacted).toBe("After-hours crisis, homelessness, FDV, child-safety concerns");
    expect(compacted.includes("|")).toBe(false);
    expect(compacted.length).toBeLessThanOrEqual(120);
  });

  it("compacts pipe-joined patient-group blobs in best-use card detail", () => {
    const snapshot = loadServicesSnapshot();
    const communitySru = snapshot.services.find(
      (service) => service.canonical_name_key === "community-supported-residential-units",
    );
    expect(communitySru?.patient_group?.includes("|")).toBe(true);
    expect(communitySru!.patient_group.length).toBeGreaterThan(140);

    const record = catalogToServiceRecord(communitySru!);
    const bestUseCard = record.summaryCards?.find((card) => card.id === "best-use");
    expect(bestUseCard?.detail).toBeTruthy();
    expect(bestUseCard!.detail!.length).toBeLessThanOrEqual(120);
    expect(bestUseCard!.detail).not.toContain("|");
  });

  it("omits filler cost cards when funding is unknown", () => {
    const snapshot = loadServicesSnapshot();
    const unknownCost = snapshot.services.find((service) => {
      const value = service.cost_funding.trim();
      return !value || /^(?:not publicly stated|not applicable|none|n\/a|unknown)$/i.test(value);
    });
    expect(unknownCost).toBeTruthy();
    const record = catalogToServiceRecord(unknownCost!);
    expect(record.cost).toBeUndefined();
    expect(record.summaryCards?.some((card) => card.id === "cost")).toBe(false);
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

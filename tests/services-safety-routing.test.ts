import { describe, expect, it } from "vitest";

import { catalogToServiceRecord } from "@/lib/service-catalog-mapper";
import { loadServicesSnapshot } from "@/lib/service-catalog";
import { detectServiceUrgentIntents } from "@/lib/service-urgent-routing";
import { rankServiceRecords } from "@/lib/service-ranker";
import { serviceRecords } from "@/lib/services";
import { serviceCatalogTags } from "@/lib/service-facets";
import { canonicalServiceRecords } from "@/lib/service-governance";

function titles(query: string, limit = 8) {
  return rankServiceRecords(serviceRecords, query, limit, [], true).map(({ service }) => service.title);
}

describe("services safety routing", () => {
  it("recognises high-consequence intent without conflating aftercare and postvention", () => {
    expect(detectServiceUrgentIntents("15-year-old actively suicidal in Bunbury tonight")).toEqual(
      expect.arrayContaining(["emergency", "camhs_crisis", "regional_after_hours"]),
    );
    expect(detectServiceUrgentIntents("discharged after a suicide attempt and needs follow-up")).toContain(
      "suicide_aftercare",
    );
    expect(detectServiceUrgentIntents("bereaved after my brother died by suicide")).toContain("suicide_postvention");
    expect(detectServiceUrgentIntents("bereaved after my brother died by suicide")).not.toContain("suicide_aftercare");
  });

  it("pins the immediate emergency, CAMHS crisis and regional after-hours routes for a clear youth crisis", () => {
    const resultTitles = titles("15-year-old actively suicidal in Bunbury tonight", 8);
    expect(resultTitles.slice(0, 4)).toEqual(
      expect.arrayContaining(["Emergency services", "CAMHS Crisis Connect", "Rurallink"]),
    );
  });

  it("never pins planned, closed, superseded or temporarily-unavailable services as an immediate route", () => {
    const matches = rankServiceRecords(
      serviceRecords,
      "15-year-old actively suicidal in Bunbury tonight",
      12,
      [],
      true,
    );
    const pinned = matches.filter(({ reasons }) => reasons.includes("urgent route"));
    expect(pinned.length).toBeGreaterThan(0);
    for (const { service, reasons } of pinned) {
      const status = service.verification?.availabilityStatus ?? "active";
      // A camhs_crisis match is allowed to stay pinned when it is only "unknown" (not yet
      // re-verified) rather than a confirmed non-active status — see service-urgent-routing.ts.
      // Every other urgent intent still requires a fully active, confirmed status.
      const isCamhsCrisis = reasons.includes("camhs crisis");
      if (isCamhsCrisis) {
        expect(["active", "unknown"]).toContain(status);
      } else {
        expect(status).toBe("active");
      }
    }
  });
});

describe("services provenance presentation", () => {
  it("keeps evidence URLs out of contact links unless the URL is the service website", () => {
    const snapshot = loadServicesSnapshot();
    const mherl = snapshot.services.find((service) => service.name.includes("Mental Health Emergency Response Line"));
    expect(mherl).toBeTruthy();

    const record = catalogToServiceRecord(mherl!);
    const websiteContacts = record.contacts?.filter((contact) => contact.kind === "web") ?? [];
    const expected = mherl!.service_website ? [mherl!.service_website] : [];
    expect(websiteContacts.map((contact) => contact.value)).toEqual(expected);
    expect(websiteContacts.every((contact) => contact.detail === "Service website")).toBe(true);
    expect(record.source?.url).toBe(mherl!.public_source_urls[0]);
  });

  it("does not label non-active or overdue records as source checked", () => {
    const snapshot = loadServicesSnapshot();
    const nonActive = snapshot.services.find(
      (service) => service.availability_status && service.availability_status !== "active",
    );
    expect(nonActive).toBeTruthy();
    const record = catalogToServiceRecord(nonActive!);
    expect(record.source?.status).not.toBe("Source checked");
  });

  it("splits a composite Metro/Peel phone contact into separately-dialable numbers", () => {
    const snapshot = loadServicesSnapshot();
    const mherl = snapshot.services.find((service) => service.name.includes("Mental Health Emergency Response Line"));
    expect(mherl).toBeTruthy();

    const record = catalogToServiceRecord(mherl!);
    const phoneContacts = record.contacts?.filter((contact) => contact.kind === "phone") ?? [];
    expect(phoneContacts.length).toBe(2);
    const compact = phoneContacts.map((contact) => contact.value?.replace(/[^\d+]/g, ""));
    expect(compact).toEqual(["1300555788", "1800676822"]);
    // Never a single contact holding both numbers concatenated into one undialable string.
    expect(compact.every((value) => value !== "13005557881800676822")).toBe(true);
  });

  it("splits a composite Metro/Country phone contact into separately-dialable numbers", () => {
    const snapshot = loadServicesSnapshot();
    const aod = snapshot.services.find((service) => service.name === "Alcohol and Drug Support Line");
    expect(aod).toBeTruthy();

    const record = catalogToServiceRecord(aod!);
    const phoneContacts = record.contacts?.filter((contact) => contact.kind === "phone") ?? [];
    expect(phoneContacts.length).toBe(2);
    const compact = phoneContacts.map((contact) => contact.value?.replace(/[^\d+]/g, ""));
    expect(compact).toEqual(["0894425000", "1800198024"]);
  });
});

describe("sexual assault, family violence and postvention records", () => {
  const byId = new Map(canonicalServiceRecords().map((record) => [record.id, record]));

  it("carries the sexual assault and family violence crisis routes the catalogue was missing", () => {
    for (const id of ["SVC-SV-001", "SVC-FDV-003"]) {
      const record = byId.get(id);
      expect(record, `${id} is missing from the canonical catalogue`).toBeDefined();
      expect(record?.tier).toBe("A_immediate");
      expect(record?.status).toBe("active");
      expect(record?.contacts.some((contact) => contact.value.trim())).toBe(true);
      expect(record?.hours.display.trim()).not.toBe("");
    }
  });

  it("keeps postvention and aftercare off the immediate tier and says so in the record", () => {
    for (const id of ["SVC-SUI-003", "SVC-POS-001", "SVC-POS-002", "SVC-POS-003", "SVC-POS-004"]) {
      const record = byId.get(id);
      expect(record, `${id} is missing from the canonical catalogue`).toBeDefined();
      expect(record?.tier).toBe("B_common_referral");
      expect(record?.notFor.some((value) => /not an acute crisis line/i.test(value))).toBe(true);
    }
  });

  it("does not claim hours a source page never stated", () => {
    for (const id of ["SVC-SUI-003", "SVC-SUI-004", "SVC-POS-001", "SVC-POS-002", "SVC-POS-003", "SVC-POS-004"]) {
      expect(byId.get(id)?.hours.verification_status).toBe("unable_to_verify");
    }
  });

  it("gives every new record a dated source from the publisher's own page", () => {
    for (const id of [
      "SVC-SV-001",
      "SVC-FDV-003",
      "SVC-SUI-003",
      "SVC-SUI-004",
      "SVC-POS-001",
      "SVC-POS-002",
      "SVC-POS-003",
      "SVC-POS-004",
    ]) {
      const sources = byId.get(id)?.sources ?? [];
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.accessed).toBe("2026-09-16");
        expect(source.date).toMatch(/\b(19|20)\d{2}\b/);
      }
    }
  });
});

describe("canonical records that must not merge into a legacy entry", () => {
  it("keeps the KEMH Mother Baby Unit separate from the Fiona Stanley record", () => {
    const slugs = new Set(serviceRecords.map((record) => record.slug));
    // The legacy Fiona Stanley entry carries "Mother Baby Unit" as a merged alias, so a
    // generic match key on the KEMH record silently merged the two and union-ed their
    // tags, producing a record that named one hospital and dialled the other.
    expect(slugs.has("kemh-mother-baby-unit")).toBe(true);
    expect(slugs.has("mother-and-baby-mental-health-unit-fiona-stanley-hospital")).toBe(true);
  });

  it("gives every service exactly one substance flag, which a silent merge breaks", () => {
    for (const record of serviceRecords) {
      expect(serviceCatalogTags(record).substance_flags, `${record.slug} substance flags`).toHaveLength(1);
    }
  });
});

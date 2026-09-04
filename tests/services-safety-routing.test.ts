import { describe, expect, it } from "vitest";

import { catalogToServiceRecord } from "@/lib/service-catalog-mapper";
import { loadServicesSnapshot } from "@/lib/service-catalog";
import {
  detectServiceUrgentIntents,
  type ServiceUrgentIntent,
} from "@/lib/service-urgent-routing";
import { rankServiceRecords } from "@/lib/service-ranker";
import { serviceRecords } from "@/lib/services";

function titles(query: string, limit = 8) {
  return rankServiceRecords(serviceRecords, query, limit, [], true).map(({ service }) => service.title);
}

describe("services safety routing", () => {
  it("recognises high-consequence intent without conflating aftercare and postvention", () => {
    expect(detectServiceUrgentIntents("15-year-old actively suicidal in Bunbury tonight")).toEqual(
      expect.arrayContaining<ServiceUrgentIntent>(["emergency", "camhs_crisis", "regional_after_hours"]),
    );
    expect(detectServiceUrgentIntents("discharged after a suicide attempt and needs follow-up")).toContain(
      "suicide_aftercare",
    );
    expect(detectServiceUrgentIntents("bereaved after my brother died by suicide")).toContain("suicide_postvention");
    expect(detectServiceUrgentIntents("bereaved after my brother died by suicide")).not.toContain(
      "suicide_aftercare",
    );
  });

  it("pins the immediate emergency, CAMHS crisis and regional after-hours routes for a clear youth crisis", () => {
    const resultTitles = titles("15-year-old actively suicidal in Bunbury tonight", 8);
    expect(resultTitles.slice(0, 4)).toEqual(
      expect.arrayContaining(["Emergency services", "CAMHS Crisis Connect", "Rurallink"]),
    );
  });

  it("never pins planned, closed, superseded or legacy-unverified services as an immediate route", () => {
    const matches = rankServiceRecords(serviceRecords, "15-year-old actively suicidal in Bunbury tonight", 12, [], true);
    const pinned = matches.filter(({ reasons }) => reasons.includes("urgent route"));
    expect(pinned.length).toBeGreaterThan(0);
    for (const { service } of pinned) {
      expect(service.verification?.availabilityStatus ?? "active").toBe("active");
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
    const nonActive = snapshot.services.find((service) => service.availability_status && service.availability_status !== "active");
    expect(nonActive).toBeTruthy();
    const record = catalogToServiceRecord(nonActive!);
    expect(record.source?.status).not.toBe("Source checked");
  });
});

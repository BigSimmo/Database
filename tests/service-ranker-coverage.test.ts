import { describe, expect, it } from "vitest";

import { rankServiceRecords, serviceRecordSearchText } from "@/lib/service-ranker";
import { serviceRecords } from "@/lib/services";
import { rankServiceUrgentRoutes } from "@/lib/service-urgent-routing";

// Ledger #CNCAFV. The catalogue ranker keeps any record scoring on ANY query
// term, and "disorder" in a title outweighs "panic" in the body, so "panic
// disorder" put eating-disorder services first, badged "Best fit".
describe("service search coverage of the distinctive query terms", () => {
  // No service record says "panic"; four say "anxiety", its listed family word.
  const mentionsPanic = (slug: string) => {
    const text = serviceRecordSearchText(serviceRecords.find((service) => service.slug === slug)!);
    return text.includes("panic") || text.includes("anxiety");
  };
  const urgentFor = (query: string) =>
    new Set(rankServiceUrgentRoutes(serviceRecords, query).map(({ service }) => service.slug));

  it("ranks every service that mentions the specific condition above those that only share a generic word", () => {
    const ranked = rankServiceRecords(serviceRecords, "panic disorder", serviceRecords.length, [], true);
    const urgent = urgentFor("panic disorder");
    const ordinary = ranked.filter(({ service }) => !urgent.has(service.slug));
    const flags = ordinary.map(({ service }) => mentionsPanic(service.slug));
    expect(flags.some(Boolean)).toBe(true);
    const firstWithout = flags.indexOf(false);
    if (firstWithout !== -1) expect(flags.slice(firstWithout).some(Boolean)).toBe(false);
  });

  it("marks a match as covering the query only when it contains every distinctive term", () => {
    const urgent = urgentFor("panic disorder");
    const ranked = rankServiceRecords(serviceRecords, "panic disorder", serviceRecords.length, [], true);
    for (const match of ranked.filter(({ service }) => !urgent.has(service.slug))) {
      expect(match.coversQuery, match.service.slug).toBe(mentionsPanic(match.service.slug));
    }
    // The four anxiety services are found at all, and lead the ordinary results.
    expect(ranked.filter(({ coversQuery }) => coversQuery).length).toBeGreaterThanOrEqual(4);
  });

  it("never claims coverage for a query made only of generic words", () => {
    const urgent = urgentFor("mental health services");
    for (const match of rankServiceRecords(serviceRecords, "mental health services", serviceRecords.length)) {
      if (!urgent.has(match.service.slug)) expect(match.coversQuery).toBe(false);
    }
  });
});

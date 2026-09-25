import { describe, expect, it } from "vitest";

import { rankServiceRecords, serviceRecordSearchText } from "@/lib/service-ranker";
import { serviceRecords } from "@/lib/services";
import { rankServiceUrgentRoutes } from "@/lib/service-urgent-routing";

// Ledger #CNCAFV. The catalogue ranker keeps any record scoring on ANY query
// term, and "disorder" in a title outweighs "panic" in the body, so "panic
// disorder" put eating-disorder services first. The "Best fit" badge itself is
// covered by tests/service-best-fit.test.ts.
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

  it("finds the anxiety services for panic even though no record says panic", () => {
    const ranked = rankServiceRecords(serviceRecords, "panic disorder", serviceRecords.length, [], true);
    const urgent = urgentFor("panic disorder");
    const ordinary = ranked.filter(({ service }) => !urgent.has(service.slug));
    expect(ordinary.slice(0, 4).every(({ service }) => mentionsPanic(service.slug))).toBe(true);
  });
});

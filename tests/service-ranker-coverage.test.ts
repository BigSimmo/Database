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

  it("leaves out services that matched only on generic words once some service matches the condition", () => {
    const ranked = rankServiceRecords(serviceRecords, "panic disorder", serviceRecords.length, [], true);
    const urgent = urgentFor("panic disorder");
    const ordinary = ranked.filter(({ service }) => !urgent.has(service.slug));
    expect(ordinary.length).toBeGreaterThan(0);
    expect(ordinary.every(({ service }) => mentionsPanic(service.slug))).toBe(true);
    expect(ranked.some(({ service }) => service.slug.includes("eating-disorder"))).toBe(false);
  });

  it("still pins every urgent route for the query", () => {
    const ranked = rankServiceRecords(serviceRecords, "panic disorder", serviceRecords.length, [], true);
    const slugs = new Set(ranked.map(({ service }) => service.slug));
    for (const slug of urgentFor("panic disorder")) expect(slugs.has(slug)).toBe(true);
  });

  it("keeps eating-disorder services for an eating-disorder search", () => {
    const top = rankServiceRecords(serviceRecords, "eating disorder", serviceRecords.length, [], true).slice(0, 5);
    expect(top.every(({ service }) => /eating/.test(serviceRecordSearchText(service)))).toBe(true);
  });

  it("keeps typo matches when no service literally names the condition", () => {
    const ranked = rankServiceRecords(serviceRecords, "anxeity", serviceRecords.length, [], true);
    expect(ranked.length).toBeGreaterThan(0);
  });

  it("still returns results for a query made only of generic words", () => {
    expect(
      rankServiceRecords(serviceRecords, "mental health clinic", serviceRecords.length, [], true).length,
    ).toBeGreaterThan(0);
  });

  it("narrows a youth search to services that mention youth", () => {
    const ranked = rankServiceRecords(serviceRecords, "youth mental health", serviceRecords.length, [], true);
    const urgent = urgentFor("youth mental health");
    const ordinary = ranked.filter(({ service }) => !urgent.has(service.slug));
    expect(ordinary.length).toBeGreaterThan(0);
    expect(ordinary.length).toBeLessThan(serviceRecords.length / 2);
  });
});

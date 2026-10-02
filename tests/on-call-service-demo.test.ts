import { describe, expect, it } from "vitest";
import { handbookMobileRoute } from "@/lib/on-call/handbook-title";
import { resolveHandbookPhone } from "@/lib/on-call/number-resolver";
import { demoServiceDetail } from "@/lib/on-call/service-demo";
describe("synthetic hospital numbers", () => {
  it("uses reserved numbers for every externally diallable route", () => {
    let routes = 0;
    for (const entry of demoServiceDetail.entries)
      for (const content of [entry.content, entry.publishedContent]) {
        if (!content) continue;
        for (const value of [content.phone, handbookMobileRoute(content.body)]) {
          if (!value) continue;
          const dial = resolveHandbookPhone(value);
          if (!dial.tel) continue;
          expect(dial.tel, content.title).toMatch(/^tel:085550\d{4}(,\d+)?$/);
          routes++;
        }
      }
    expect(routes).toBeGreaterThan(0);
  });
});

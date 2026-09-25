import { describe, expect, it } from "vitest";

import { bestFitQueryTokens, serviceMatchesEveryQueryToken } from "@/lib/service-best-fit";
import { serviceRecords } from "@/lib/services";

describe("service-best-fit token coverage", () => {
  it("drops connective stopwords and normalizes the remaining tokens", () => {
    expect(bestFitQueryTokens("help for a panic disorder")).toEqual(["help", "panic", "disorder"]);
    expect(bestFitQueryTokens("   ")).toEqual([]);
    expect(bestFitQueryTokens("and the of")).toEqual([]);
  });

  it("gives an eating-disorder record no best-fit claim for an unrelated query", () => {
    const eatingDisorderService = serviceRecords.find((service) => /eating disorder/i.test(service.title));
    expect(eatingDisorderService, "expected an eating-disorder record in the catalogue").toBeTruthy();

    // "panic" appears nowhere in the eating-disorder record's own text, so it must not
    // wear a badge that reads as "this is the best fit" for a panic disorder query.
    expect(serviceMatchesEveryQueryToken(eatingDisorderService!, "panic disorder")).toBe(false);
  });

  it("gives the same record a best-fit claim when every query word is actually its own", () => {
    const eatingDisorderService = serviceRecords.find((service) => /eating disorder/i.test(service.title));
    expect(eatingDisorderService).toBeTruthy();

    expect(serviceMatchesEveryQueryToken(eatingDisorderService!, "eating disorder")).toBe(true);
  });

  it("treats an empty or all-stopword query as no contradiction (browse mode unaffected)", () => {
    const anyService = serviceRecords[0];
    expect(anyService).toBeTruthy();
    expect(serviceMatchesEveryQueryToken(anyService, "")).toBe(true);
    expect(serviceMatchesEveryQueryToken(anyService, "the")).toBe(true);
  });

  it("fails when only some query tokens are covered by the record", () => {
    const eatingDisorderService = serviceRecords.find((service) => /eating disorder/i.test(service.title));
    expect(eatingDisorderService).toBeTruthy();

    // "eating" is covered, "waitlist" is not — every token must match, not just some.
    expect(serviceMatchesEveryQueryToken(eatingDisorderService!, "eating disorder waitlist")).toBe(false);
  });
});

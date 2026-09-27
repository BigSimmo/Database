import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerCrisisBanner } from "@/components/clinical-dashboard/answer-crisis-banner";
import { hasCrisisWording } from "@/lib/crisis-wording";

describe("hasCrisisWording", () => {
  it.each([
    "I want to kill myself",
    "i want to die",
    "thinking about ending my life",
    "suicidal ideation risk assessment",
    "self-harm after a car accident",
    "selfharm in adolescents",
    "paracetamol overdose psychiatric review",
    "my patient is in immediate danger",
  ])("matches %j", (query) => {
    expect(hasCrisisWording(query)).toBe(true);
  });

  it.each([
    "flight of ideas in mania",
    "acute agitation management",
    "crisis team referral pathway",
    "clozapine ANC thresholds",
    "best coffee machine",
    "",
  ])("does not match %j", (query) => {
    expect(hasCrisisWording(query)).toBe(false);
  });

  it("is null-safe", () => {
    expect(hasCrisisWording(null)).toBe(false);
    expect(hasCrisisWording(undefined)).toBe(false);
  });
});

describe("AnswerCrisisBanner", () => {
  it("prints 000, Lifeline and MHERL as tap-to-call links from the shared contact list", () => {
    const html = renderToStaticMarkup(<AnswerCrisisBanner />);
    expect(html).toContain('href="tel:000"');
    expect(html).toContain('href="tel:131114"');
    expect(html).toContain("13 11 14");
    expect(html).toContain('href="tel:1300555788"');
    expect(html).toContain('role="status"');
  });
});

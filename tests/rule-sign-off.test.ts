import { describe, expect, it } from "vitest";

import { isNamedPerson, ruleContentSha256, ruleGate, UNSIGNED, type RuleSignOff } from "@/lib/admin/rule-sign-off";

const content = { rules: { a: { hours: 10, quote: "at least a 10 hour break" } } };

function signed(overrides: Partial<RuleSignOff> = {}): RuleSignOff {
  return {
    enabled: true,
    signedBy: "Dr Jane Example",
    signedAt: "2026-10-04T01:30:00.000Z",
    signedContentSha256: ruleContentSha256(content),
    ...overrides,
  };
}

describe("isNamedPerson", () => {
  it("accepts a given and family name, with or without a title", () => {
    expect(isNamedPerson("Jane Example")).toBe(true);
    expect(isNamedPerson("Dr Jane Example")).toBe(true);
    expect(isNamedPerson("  A/Prof   Jane   Example ")).toBe(true);
  });

  it("rejects system names, roles, single names and blanks", () => {
    for (const name of [
      "PsychSift",
      "psychsift",
      "System",
      "Locally reviewed",
      "Dr Jane",
      "Jane",
      "Dr",
      "",
      "  ",
      null,
    ]) {
      expect(isNamedPerson(name)).toBe(false);
    }
    expect(isNamedPerson("PsychSift Team")).toBe(false);
    expect(isNamedPerson("Consultant Psychiatrist")).toBe(false);
  });
});

describe("ruleGate", () => {
  it("ships off: the empty sign-off is unsigned", () => {
    expect(ruleGate(UNSIGNED, content)).toEqual({ on: false, reason: "unsigned" });
  });

  it("is on only with a named signer, a UTC time, a matching pin and the switch on", () => {
    expect(ruleGate(signed(), content)).toEqual({ on: true });
  });

  it("names the first reason it is off", () => {
    expect(ruleGate(signed({ signedBy: "PsychSift" }), content)).toEqual({ on: false, reason: "not-a-named-person" });
    expect(ruleGate(signed({ signedAt: "2026-10-04" }), content)).toEqual({ on: false, reason: "bad-sign-off-time" });
    expect(ruleGate(signed({ signedAt: "2026-10-04T09:30:00+08:00" }), content)).toEqual({
      on: false,
      reason: "bad-sign-off-time",
    });
    expect(ruleGate(signed({ enabled: false }), content)).toEqual({ on: false, reason: "switched-off" });
  });

  it("turns off when any figure changes after signing", () => {
    const edited = { rules: { a: { hours: 8, quote: "at least a 10 hour break" } } };
    expect(ruleGate(signed(), edited)).toEqual({ on: false, reason: "content-changed-since-sign-off" });
  });

  it("pins content, not key order", () => {
    expect(ruleContentSha256({ b: 1, a: { d: 2, c: 3 } })).toBe(ruleContentSha256({ a: { c: 3, d: 2 }, b: 1 }));
  });
});

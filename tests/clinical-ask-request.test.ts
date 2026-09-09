import { describe, expect, it } from "vitest";
import { clinicalAskCases } from "./fixtures/clinical-ask-cases";
import { clinicalAskRequestSchema } from "@/lib/validation/clinical-ask-request";

describe("clinicalAskRequestSchema", () => {
  it.each(clinicalAskCases)("accepts $mode", (request) =>
    expect(clinicalAskRequestSchema.safeParse(request).success).toBe(true),
  );
  it.each([
    { mode: "answer" },
    { question: " " },
    { question: "x".repeat(2_001) },
    { confirmedContext: { unexpected: "value" } },
    { priorTurns: Array.from({ length: 7 }, () => ({ role: "user", text: "synthetic" })) },
    { unexpected: true },
  ])("rejects invalid bounded input %#", (change) =>
    expect(clinicalAskRequestSchema.safeParse({ ...clinicalAskCases[0], ...change }).success).toBe(false),
  );
});

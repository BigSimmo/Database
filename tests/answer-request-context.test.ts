import { describe, expect, it } from "vitest";
import { answerRequestSchema } from "@/lib/validation/answer-request";
import {
  parseAnswerRequestContext,
  renderAnswerRequestContext,
  resolveAnswerRequestContext,
} from "@/lib/answer-request-context";

describe("bounded resolved answer request", () => {
  const resolve = (prior: string | undefined, latest: string) =>
    renderAnswerRequestContext(resolveAnswerRequestContext(prior, latest));
  it.each([
    ["For this, no supplements", "For this, allow approved supplements"],
    ["For this, allow approved supplements", "For this, no supplements"],
  ])("P12A R1 retains last-occurrence chronological constraints: %s", (first, second) => {
    const query = resolve(resolve(resolve(resolve("lithium dosing", first), second), first), "Elaborate");
    expect(parseAnswerRequestContext(query)).toMatchObject({
      subject: "lithium dosing",
      constraints: [second, first],
      latestRequest: "Elaborate",
      depth: "detailed",
    });
    expect(query.length).toBeLessThanOrEqual(2000);
    expect(query.match(/Follow-up context/g)).toHaveLength(1);
  });
  it("P12A R1 retains the four-distinct-constraint bound after ordered deduplication", () => {
    const prefix = ["For this, monitor", "For this, review", "For this, discuss", "For this, explain"];
    const query = prefix.reduce((prior, latest) => resolve(prior, latest), "lithium dosing");
    const atBound = resolve(query, "For this, elaborate");
    expect(parseAnswerRequestContext(atBound)?.constraints).toHaveLength(4);
    expect(() => resolve(atBound, "What about safety?")).toThrow("Too many retained answer constraints");
  });
  it.each(["And risks?", "And the risks?", "And dosing?", "And monitoring?", "And management?"])(
    "P12A retains a bounded generic-facet continuation: %s",
    (latest) => {
      const prior = resolve("lithium dosing", "What about monitoring?");
      expect(parseAnswerRequestContext(resolve(prior, latest))).toMatchObject({
        subject: "lithium dosing",
        constraints: ["What about monitoring?"],
        latestRequest: latest,
      });
    },
  );
  it.each([
    "And diabetes?",
    "And clozapine monitoring?",
    "And risks of clozapine?",
    "And dosing for clozapine?",
    "New topic: monitoring?",
  ])("P12A does not inherit a named subject or explicit reset: %s", (latest) => {
    expect(resolve(resolve("lithium dosing", "What about monitoring?"), latest)).toBe(
      latest.replace(/^New topic: /, ""),
    );
  });
  it.each(["Give an example.", "Please elaborate on monitoring."])(
    "T8-R2 retains the resolved subject for dependent request %s",
    (latest) => {
      const prior =
        latest === "Give an example." ? "lithium dosing" : resolve("lithium dosing", "what about monitoring?");
      expect(parseAnswerRequestContext(resolve(prior, latest))).toMatchObject({
        subject: "lithium dosing",
        latestRequest: latest,
        depth: "detailed",
      });
      expect(resolve(prior, "Explain clozapine monitoring")).toBe("Explain clozapine monitoring");
    },
  );
  it.each(["lithium dosing", resolve("lithium dosing", "what about monitoring?")])(
    "T8-R3 distinguishes dependent elaboration from a named new topic after %s",
    (prior) => {
      expect(resolve(prior, "Please elaborate on clozapine monitoring.")).toBe(
        "Please elaborate on clozapine monitoring.",
      );
      expect(parseAnswerRequestContext(resolve(prior, "Please elaborate on monitoring."))?.subject).toBe(
        "lithium dosing",
      );
      expect(parseAnswerRequestContext(resolve(prior, "Give an example."))?.subject).toBe("lithium dosing");
      expect(resolve(prior, "Explain clozapine monitoring")).toBe("Explain clozapine monitoring");
    },
  );
  it.each([
    ["dosing and monitoring", "clozapine dosing and monitoring"],
    ["this in detail", "this and clozapine monitoring in detail"],
    ["the dosing, monitoring and risks in more detail", "the clozapine dosing, monitoring and risks in more detail"],
    ["its monitoring in greater detail", "its clozapine monitoring in greater detail"],
    ["dosing or monitoring in depth", "clozapine dosing or monitoring in depth"],
    ["the risks of this with an example", "the risks of clozapine with an example"],
    ["monitoring\nin detail", "monitoring\nfor clozapine in detail"],
  ])("T8-R4 separates elaboration grammar and depth from a new subject: %s", (target, newTarget) => {
    const latest = `Please elaborate on ${target}.`;
    const fresh = `Please elaborate on ${newTarget}.`;
    for (const prior of ["lithium dosing", resolve("lithium dosing", "what about monitoring?")]) {
      expect.soft(parseAnswerRequestContext(resolve(prior, latest))).toEqual({
        version: "answer-request-context-v1",
        subject: "lithium dosing",
        constraints: prior === "lithium dosing" ? [] : ["what about monitoring?"],
        latestRequest: latest,
        depth: "detailed",
      });
      expect.soft(resolve(prior, fresh)).toBe(fresh);
    }
  });
  it("T8-R1 retains monitoring through elaboration and replaces subject constraints without leaking topics", () => {
    expect(resolve(resolve("lithium dosing", "what about monitoring?"), "Please elaborate with an example.")).toContain(
      "monitoring",
    );
    expect(resolve("lithium dosing with renal impairment", "instead with normal renal function")).not.toContain(
      "renal impairment",
    );
    expect(resolve("lithium dosing", "Explain clozapine monitoring")).toBe("Explain clozapine monitoring");
  });
  it("T8-R2 rejects oversized prior requests with meaningful tail constraints", () => {
    expect(() =>
      resolve("lithium dosing " + "context ".repeat(270) + "TAIL_RESTRICTION_CANARY", "what about monitoring?"),
    ).toThrow("prior");
  });
  it("retains two follow-ups and requested depth without prior model prose", () => {
    const first = resolve("lithium dosing", "what about renal impairment?");
    const second = resolve(first, "Please elaborate with an example.");
    expect(parseAnswerRequestContext(second)).toMatchObject({
      subject: "lithium dosing",
      constraints: ["what about renal impairment?"],
      latestRequest: "Please elaborate with an example.",
      depth: "detailed",
    });
    expect(
      resolve(
        second,
        "How does this affect monitoring when the patient has recently been unwell and needs further investigation?",
      ),
    ).toContain("renal impairment");
  });
  it("resets topics and replaces a population constraint", () => {
    expect(resolve("lithium dosing", "New topic: clozapine monitoring")).toBe("clozapine monitoring");
    const first = resolve("lithium dosing in adults", "what about children?");
    expect(first).toContain("children");
    expect(first).not.toContain("adults");
    expect(
      resolve(resolve("lithium dosing", "what about renal impairment?"), "instead without renal impairment"),
    ).not.toContain("what about renal impairment");
  });
  it("P08C preserves inherited depth and material constraints within the strict transport limit", () => {
    const detailed = resolve("Explain lithium dosing in detail", "what about renal impairment?");
    const next = resolve(detailed, "and for children?");
    expect(parseAnswerRequestContext(next)?.depth).toBe("detailed");
    expect(next).toContain("renal impairment");
    const escaped = resolve('lithium "dosing"', "what about renal impairment with " + '\"'.repeat(100));
    expect(answerRequestSchema.safeParse({ query: escaped }).success).toBe(true);
    expect(parseAnswerRequestContext(escaped)?.latestRequest).toContain('\"'.repeat(100));
    expect(() => resolve('lithium "dosing"', "what about " + '\"'.repeat(980))).toThrow(RangeError);
    expect(() => resolve("Follow-up context v2: {}", "what about this?")).toThrow("Invalid prior answer context");
  });
  it("fails closed on malformed versions, extra fields and overlong envelopes", () => {
    for (const query of [
      "Follow-up context v2: {}",
      "Follow-up context v1: {}",
      "Follow-up context v1: " + "x".repeat(2000),
    ])
      expect(parseAnswerRequestContext(query)).toBeNull();
    expect(() => resolve("lithium dosing", "what about " + "x".repeat(2000))).toThrow(RangeError);
  });
});

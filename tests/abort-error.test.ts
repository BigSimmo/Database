import { describe, expect, it } from "vitest";

import { isAbortError } from "../src/lib/abort-error";

/**
 * Small predicate, disproportionate consequences.
 *
 * Callers use this to tell "the deadline expired" from "the dependency is broken", and those two
 * send an investigation to opposite places. Getting it wrong is not a loud failure: the request
 * still completes, the response still reports a fault, and the fault simply names the wrong
 * system.
 */
describe("isAbortError", () => {
  it("recognises both shapes the platform actually throws", () => {
    expect(isAbortError(Object.assign(new Error("timed out"), { name: "TimeoutError" }))).toBe(true);
    expect(isAbortError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(true);
  });

  it("recognises a real expired AbortSignal.timeout, not just a hand-built lookalike", async () => {
    const signal = AbortSignal.timeout(1);
    const reason = await new Promise<unknown>((resolve) =>
      signal.addEventListener("abort", () => resolve(signal.reason), { once: true }),
    );

    expect(isAbortError(reason)).toBe(true);
  });

  it("does not claim ordinary dependency failures", () => {
    expect(isAbortError(new Error("permission denied for table documents"))).toBe(false);
    expect(isAbortError(new Error("canceling statement due to statement timeout"))).toBe(false);
  });

  it("survives the values that reach a catch block in practice", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError("TimeoutError")).toBe(false);
    expect(isAbortError({})).toBe(false);
  });
});

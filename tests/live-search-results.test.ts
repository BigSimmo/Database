import { describe, expect, it } from "vitest";

import { assessSearchProbe, liveSearchProbes, summariseSearchProbes } from "../scripts/check-live-search-results.mjs";

/**
 * Pins the monitor against the outage it was written for.
 *
 * Between 2026-09-09 and 2026-09-16 the live site returned zero results for every catalogue search
 * while every existing probe stayed green, because they all measured status codes and a search
 * returning nothing is a 200. The two cases that matter here are `no_results` — the outage as it
 * happened — and `degraded` — the same outage as it now presents, with the seed fallback serving
 * real items while the published catalogue is unreachable.
 *
 * If one of these fails, do not relax it. Each corresponds to a shape of live failure that this
 * repository has either already shipped or deliberately introduced as a survival mechanism.
 */

function group(overrides: Record<string, unknown> = {}) {
  return { kind: "forms", total: 5, items: [{ id: "a" }], latencyMs: 120, ...overrides };
}

function response(overrides: Record<string, unknown> = {}) {
  return { status: 200, body: { groups: [group(overrides)] } };
}

describe("assessSearchProbe", () => {
  it("passes a domain that returns results canonically", () => {
    const verdict = assessSearchProbe({ domain: "forms", ...response() });
    expect(verdict.ok).toBe(true);
    expect(verdict.message).toContain("5 result(s)");
  });

  // THE OUTAGE. An errored empty group inside an HTTP 200 body.
  it("fails a domain that returned zero results", () => {
    const verdict = assessSearchProbe({ domain: "forms", ...response({ total: 0, items: [], latencyMs: 2503 }) });
    expect(verdict.ok).toBe(false);
    expect(verdict.code).toBe("no_results");
  });

  it("fails a domain the search path marked errored", () => {
    const verdict = assessSearchProbe({
      domain: "forms",
      ...response({ total: 0, items: [], error: true, latencyMs: 2503 }),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.code).toBe("domain_errored");
  });

  // THE FALSE NEGATIVE THIS CHECK MUST NOT HAVE. With the seed fallback in place the same database
  // failure returns a full, plausible result set. A monitor that only counts items calls this
  // healthy and the next outage runs unseen again.
  it("fails a domain serving seeds, even though it returned results", () => {
    const verdict = assessSearchProbe({ domain: "forms", ...response({ degraded: true, total: 5 }) });
    expect(verdict.ok).toBe(false);
    expect(verdict.code).toBe("degraded");
  });

  it("fails when the domain is missing from the response", () => {
    const verdict = assessSearchProbe({ domain: "services", ...response() });
    expect(verdict.ok).toBe(false);
    expect(verdict.code).toBe("missing_domain");
  });

  it("fails on a non-200 status or an unreadable body", () => {
    expect(assessSearchProbe({ domain: "forms", status: 503, body: null }).code).toBe("http_error");
    expect(assessSearchProbe({ domain: "forms", status: 200, body: null }).code).toBe("unreadable");
    expect(assessSearchProbe({ domain: "forms", status: 200, body: {} }).code).toBe("unreadable");
  });

  // Counting items directly covers a response that omits `total` rather than reporting it as 0.
  it("falls back to the item count when total is absent", () => {
    const verdict = assessSearchProbe({
      domain: "forms",
      status: 200,
      body: { groups: [{ kind: "forms", items: [{ id: "a" }], latencyMs: 90 }] },
    });
    expect(verdict.ok).toBe(true);
  });

  // A string has a truthy `.length`, so counting it blind let a malformed body pass as healthy —
  // an unreadable live response is precisely what this monitor exists to catch.
  it.each([
    ["a string", "ok"],
    ["an object", { length: 3 }],
    ["null", null],
  ])("does not count %s as results when total is absent", (_label, items) => {
    const verdict = assessSearchProbe({
      domain: "forms",
      status: 200,
      body: { groups: [{ kind: "forms", items, latencyMs: 90 }] },
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.code).toBe("no_results");
  });
});

describe("the probe set", () => {
  it("covers every catalogue-backed domain", () => {
    expect(liveSearchProbes.map((probe: { domain: string }) => probe.domain).sort()).toEqual([
      "forms",
      "medications",
      "services",
    ]);
  });

  it("reports failure when any domain fails, not only when all of them do", () => {
    const summary = summariseSearchProbes([
      { ok: true, message: "forms ok" },
      { ok: false, message: "services failed" },
    ]);
    expect(summary.ok).toBe(false);
    expect(summary.failed).toHaveLength(1);
  });
});

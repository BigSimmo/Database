import { describe, expect, it } from "vitest";
import {
  classifyAuditCapture,
  classifyFixturePayload,
  classifyOutdatedCapture,
} from "../scripts/lib/dependency-report-capture.mjs";
import { captureProvenance, highestSeverity, renderDependencyReport } from "../scripts/dependency-report.mjs";

/**
 * The renderer now takes classified results rather than raw npm objects. That
 * signature change IS the fix: `{}` from a successful run and `{}` conjured from a
 * failed one are the same value, so no renderer taking the raw object could ever
 * tell "nothing is outdated" from "we never found out". Every assertion the old
 * suite made is preserved below in the new shape.
 */
const ok = (value: unknown) => ({ state: "ok" as const, value, observedAt: "2026-09-17T00:00:00.000Z" });
const findings = (value: unknown) => ({ state: "findings" as const, value, observedAt: "2026-09-17T00:00:00.000Z" });
const unavailable = (reasonCode: string) => ({
  state: "unavailable" as const,
  value: null,
  reasonCode,
  observedAt: "2026-09-17T00:00:00.000Z",
});
const auditOf = (vulnerabilities: Record<string, number>) => ({ metadata: { vulnerabilities } });
const zeroAudit = auditOf({ info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 });
const capture = (payload: unknown, overrides: Record<string, unknown> = {}) => ({
  stdout: JSON.stringify(payload),
  status: 0,
  ...overrides,
});

describe("renderDependencyReport", () => {
  it("reports 'none' when nothing is outdated", () => {
    const md = renderDependencyReport(ok({}), ok(zeroAudit));
    expect(md).toContain("none 🎉");
    expect(md).toContain("Vulnerabilities:** 0 total");
  });

  it("tables outdated deps and flags major bumps", () => {
    const md = renderDependencyReport(
      findings({
        next: { current: "16.2.10", wanted: "16.2.10", latest: "16.3.0" },
        zod: { current: "3.24.0", wanted: "3.24.1", latest: "4.4.3" },
      }),
      findings(auditOf({ info: 0, low: 0, moderate: 2, high: 0, critical: 0, total: 2 })),
    );
    expect(md).toContain("2 (1 major)");
    // zod 3 → 4 is a major bump
    expect(md).toMatch(/\| zod \|.*⚠ yes \|/);
    // next 16 → 16 is not
    expect(md).toMatch(/\| next \|.*— \|/);
    expect(md).toContain("moderate 2");
  });

  it("handles missing audit data gracefully", () => {
    const md = renderDependencyReport(ok({}), unavailable("invalid_shape"));
    expect(md).toContain("measurement unavailable");
    expect(md).toContain("Counts are unknown, **not** zero");
  });

  it("renders 'unavailable' (not 'none') when the outdated check failed", () => {
    const md = renderDependencyReport(unavailable("process_failed"), ok(zeroAudit));
    expect(md).toContain("measurement unavailable");
    expect(md).toContain("not** evidence that dependencies are current");
    expect(md).not.toContain("none 🎉");
  });

  it("records measurement provenance without leaking registry or auth detail", () => {
    const md = renderDependencyReport(
      ok({}),
      ok(zeroAudit),
      captureProvenance({ GITHUB_SHA: "abcdef0123456789" }, () => Buffer.from("lockfile")),
    );
    expect(md).toContain("at `abcdef012345`");
    expect(md).toMatch(/lockfile `[0-9a-f]{16}`/);
    expect(md).not.toMatch(/registry|_authToken|npmrc/i);
  });
});

describe("highestSeverity", () => {
  it("returns the most severe non-zero level", () => {
    expect(highestSeverity(findings(auditOf({ high: 1, low: 3 })))).toBe("high");
    expect(highestSeverity(findings(auditOf({ low: 3 })))).toBe("low");
    expect(highestSeverity(ok(zeroAudit))).toBe("none");
  });

  it("returns 'unknown' — never 'none' — for an audit that did not produce a result", () => {
    // The old behaviour was `highestSeverity({}) === "none"`, which published a
    // missing measurement to the workflow as a clean one.
    expect(highestSeverity(unavailable("process_failed"))).toBe("unknown");
    expect(highestSeverity(unavailable("malformed_json"))).toBe("unknown");
    expect(highestSeverity(ok({}))).toBe("unknown");
  });
});

describe("classifyOutdatedCapture", () => {
  it("accepts a validated empty result from a clean exit", () => {
    expect(classifyOutdatedCapture({ stdout: "{}", status: 0 })).toMatchObject({ state: "ok", value: {} });
    expect(classifyOutdatedCapture({ stdout: "", status: 0 })).toMatchObject({ state: "ok", value: {} });
  });

  it("treats blank output after a failed process as unavailable, not as no findings", () => {
    expect(classifyOutdatedCapture({ stdout: "", status: 1, failed: true })).toMatchObject({
      state: "unavailable",
      reasonCode: "process_failed",
    });
    expect(classifyOutdatedCapture({ stdout: "   ", status: null, failed: true })).toMatchObject({
      state: "unavailable",
      reasonCode: "process_failed",
    });
  });

  it("classifies a kill signal as a timeout rather than a clean measurement", () => {
    expect(classifyOutdatedCapture({ stdout: "", status: null, signal: "SIGTERM", failed: true })).toMatchObject({
      state: "unavailable",
      reasonCode: "timeout",
    });
  });

  it("rejects malformed JSON, arrays, strings and npm error payloads", () => {
    expect(classifyOutdatedCapture({ stdout: "{malformed", status: 0 })).toMatchObject({
      reasonCode: "malformed_json",
    });
    expect(classifyOutdatedCapture(capture([]))).toMatchObject({ reasonCode: "invalid_shape" });
    expect(classifyOutdatedCapture(capture("nope"))).toMatchObject({ reasonCode: "invalid_shape" });
    expect(classifyOutdatedCapture(capture({ error: { code: "ENOTFOUND" } }))).toMatchObject({
      reasonCode: "npm_error_payload",
    });
  });

  it("rejects rows that carry no usable version, and keeps rows that do", () => {
    expect(classifyOutdatedCapture(capture({ zod: { current: 3 } }))).toMatchObject({ reasonCode: "invalid_shape" });
    expect(classifyOutdatedCapture(capture({ zod: {} }))).toMatchObject({ reasonCode: "invalid_shape" });
    expect(classifyOutdatedCapture(capture({ zod: null }))).toMatchObject({ reasonCode: "invalid_shape" });
    expect(classifyOutdatedCapture(capture({ zod: { current: "3.24.0", latest: "4.4.3" } }))).toMatchObject({
      state: "findings",
    });
  });

  it("keeps valid findings valid even though npm exits non-zero to report them", () => {
    expect(
      classifyOutdatedCapture(capture({ zod: { current: "3.24.0", latest: "4.4.3" } }, { status: 1 })),
    ).toMatchObject({ state: "findings" });
  });
});

describe("classifyAuditCapture", () => {
  it("accepts a fully counted zero-vulnerability result", () => {
    expect(classifyAuditCapture(capture(zeroAudit))).toMatchObject({ state: "ok" });
  });

  it("rejects an empty vulnerabilities object instead of reading it as zero", () => {
    // This is the exact payload that rendered "0 total — critical 0, high 0, …".
    expect(classifyAuditCapture(capture(auditOf({})))).toMatchObject({ reasonCode: "invalid_shape" });
  });

  it("rejects missing metadata, partial counts, and non-integer counts", () => {
    expect(classifyAuditCapture(capture({}))).toMatchObject({ reasonCode: "invalid_shape" });
    expect(classifyAuditCapture(capture(auditOf({ high: 1, total: 1 })))).toMatchObject({
      reasonCode: "invalid_shape",
    });
    expect(
      classifyAuditCapture(capture(auditOf({ info: 0, low: 0, moderate: 0, high: Number.NaN, critical: 0, total: 0 }))),
    ).toMatchObject({ reasonCode: "invalid_shape" });
    expect(
      classifyAuditCapture(capture(auditOf({ info: 0, low: 0, moderate: 0, high: -1, critical: 0, total: -1 }))),
    ).toMatchObject({ reasonCode: "invalid_shape" });
    expect(
      classifyAuditCapture(
        capture(auditOf({ info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: "1" as unknown as number })),
      ),
    ).toMatchObject({ reasonCode: "invalid_shape" });
  });

  it("rejects counts that do not add up to the stated total", () => {
    expect(
      classifyAuditCapture(capture(auditOf({ info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 9 }))),
    ).toMatchObject({ reasonCode: "invalid_shape" });
  });

  it("keeps real findings valid despite npm's non-zero findings exit", () => {
    const result = classifyAuditCapture(
      capture(auditOf({ info: 0, low: 1, moderate: 0, high: 1, critical: 0, total: 2 }), { status: 1 }),
    );
    expect(result).toMatchObject({ state: "findings" });
    expect(highestSeverity(result)).toBe("high");
  });
});

describe("classifyFixturePayload", () => {
  it("gives a --input fixture no easier path than real npm output", () => {
    const both = classifyFixturePayload(JSON.stringify({ outdated: {}, audit: auditOf({}) }));
    expect(both.outdated).toMatchObject({ state: "ok" });
    expect(both.audit).toMatchObject({ state: "unavailable", reasonCode: "invalid_shape" });
  });

  it("treats a malformed or keyless fixture as unavailable rather than empty", () => {
    expect(classifyFixturePayload("{malformed").outdated).toMatchObject({ reasonCode: "malformed_json" });
    expect(classifyFixturePayload("{}").outdated).toMatchObject({ reasonCode: "invalid_shape" });
    expect(classifyFixturePayload("{}").audit).toMatchObject({ reasonCode: "invalid_shape" });
    expect(classifyFixturePayload("").outdated).toMatchObject({ reasonCode: "invalid_shape" });
  });
});

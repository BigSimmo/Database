import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";

import { privacySafeErrorEvent, stableFrameFilename, stableFrameFunction } from "@/lib/observability/error-tracking";

/**
 * Production builds ship without uploaded source maps unless SENTRY_AUTH_TOKEN,
 * SENTRY_ORG and SENTRY_PROJECT are all set, so every frame arrives minified. The
 * fingerprint used to take the minified filename and function verbatim, and both are
 * regenerated on each build. On 2026-09-16 that had split a single recurring
 * `/api/medications` fault across 25 separate Sentry issues.
 */
describe("build-stable frame components", () => {
  it("drops numbered webpack chunk filenames and keeps route and package paths", () => {
    expect(stableFrameFilename("/app/.next/server/chunks/41261.js")).toBe("unknown");
    expect(stableFrameFilename("/app/.next/server/chunks/1523.js")).toBe("unknown");
    expect(stableFrameFilename("/app/.next/server/app/api/medications/route.js")).toBe(
      "/app/.next/server/app/api/medications/route.js",
    );
    expect(stableFrameFilename("/app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js")).toBe(
      "/app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js",
    );
    expect(stableFrameFilename(undefined)).toBe("unknown");
  });

  it("keeps the readable tail of a minified member expression", () => {
    expect(stableFrameFunction("rV.handleResponse")).toBe("handleResponse");
    expect(stableFrameFunction("d0.makeRequest")).toBe("makeRequest");
    expect(stableFrameFunction("gX.makeRequest")).toBe("makeRequest");
    expect(stableFrameFunction("Z")).toBe("unknown");
    expect(stableFrameFunction(undefined)).toBe("unknown");
  });

  it("keeps route handler names, which are two and three letters but not minifier output", () => {
    expect(stableFrameFunction("GET")).toBe("GET");
    expect(stableFrameFunction("POST")).toBe("POST");
  });
});

function eventWithTopFrame(filename: string, fn: string): ErrorEvent {
  return {
    exception: {
      values: [{ type: "Error", value: "boom", stacktrace: { frames: [{ filename, function: fn }] } }],
    },
    tags: { route_path: "/api/medications" },
    type: undefined,
  } satisfies ErrorEvent;
}

describe("fingerprint stability across deploys", () => {
  it("groups the same fault identically after chunk ids and mangled names are regenerated", () => {
    // Two builds of the same fault, exactly as the two live issues recorded it.
    const before = privacySafeErrorEvent(eventWithTopFrame("/app/.next/server/chunks/1261.js", "d0.makeRequest"));
    const after = privacySafeErrorEvent(eventWithTopFrame("/app/.next/server/chunks/41261.js", "gX.makeRequest"));

    expect(before.fingerprint).toEqual(after.fingerprint);
    expect(after.fingerprint).toEqual(["/api/medications", "Error", "unknown", "makeRequest"]);
  });

  it("still separates genuinely different faults on the same route", () => {
    const serialization = privacySafeErrorEvent(
      eventWithTopFrame("/app/.next/server/app/api/medications/route.js", "GET"),
    );
    const transport = privacySafeErrorEvent(eventWithTopFrame("/app/.next/server/chunks/41261.js", "gX.makeRequest"));

    expect(serialization.fingerprint).not.toEqual(transport.fingerprint);
  });

  it("applies the same normalisation to worker events, which group by stage rather than route", () => {
    const event: ErrorEvent = {
      exception: {
        values: [{ type: "Error", value: "boom", stacktrace: { frames: [{ filename: "/app/chunks/9912.js" }] } }],
      },
      tags: { service: "worker", worker_stage: "ocr" },
      type: undefined,
    } satisfies ErrorEvent;

    expect(privacySafeErrorEvent(event).fingerprint).toEqual(["worker", "ocr", "Error", "unknown"]);
  });
});

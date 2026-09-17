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

/**
 * The normalisation above only ever applied to events carrying a `route_path` tag, and only
 * `captureRequestError` sets one. Measured against the live project on 2026-09-17: 849 of the 853
 * error events in the preceding 30 days had no such tag, because almost everything reaches Sentry
 * through the SDK's own global handlers instead. Those events took the `: undefined` fingerprint
 * branch, which hands grouping back to Sentry's default algorithm over exactly the minified frames
 * these helpers exist to normalise — so the 2026-09-16 fix covered 0.5% of traffic and the rest
 * kept splintering. Twenty open issues shared the single title "Unhandled server request error".
 *
 * Frame arrays are ordered oldest-first, so the SDK's own frame is last; these fixtures are the
 * real stacks from issues JAVASCRIPT-NEXTJS-26, -1W and -2G.
 */
function untaggedEvent(filenames: string[], topFunction?: string): ErrorEvent {
  return {
    exception: {
      values: [
        {
          type: "Error",
          value: "boom",
          stacktrace: {
            frames: filenames.map((filename, index) => ({
              filename,
              ...(index === filenames.length - 1 && topFunction ? { function: topFunction } : {}),
            })),
          },
        },
      ],
    },
    type: undefined,
  } satisfies ErrorEvent;
}

const DIFFERENTIALS_STACK = [
  "/app/.next/server/app/api/differentials/route.js",
  "/app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js",
  "/app/.next/server/chunks/50445.js",
  "/app/.next/server/chunks/41261.js",
];
const MEDICATIONS_STACK = [
  "/app/.next/server/app/api/medications/route.js",
  "/app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js",
  "/app/.next/server/chunks/1523.js",
  "/app/.next/server/chunks/41261.js",
];
const TIMER_STACK = ["/app/.next/server/chunks/2985.js", "/app/.next/server/chunks/41261.js"];

describe("events that arrive with no route tag", () => {
  it("never hands grouping back to Sentry with an undefined fingerprint", () => {
    for (const stack of [DIFFERENTIALS_STACK, MEDICATIONS_STACK, TIMER_STACK]) {
      expect(privacySafeErrorEvent(untaggedEvent(stack)).fingerprint).toBeDefined();
    }
  });

  it("recovers the route pattern from the Next route bundle in the stack", () => {
    expect(privacySafeErrorEvent(untaggedEvent(DIFFERENTIALS_STACK)).fingerprint?.[0]).toBe("/api/differentials");
    expect(privacySafeErrorEvent(untaggedEvent(MEDICATIONS_STACK)).fingerprint?.[0]).toBe("/api/medications");
  });

  it("keeps two untagged routes in separate groups", () => {
    expect(privacySafeErrorEvent(untaggedEvent(DIFFERENTIALS_STACK)).fingerprint).not.toEqual(
      privacySafeErrorEvent(untaggedEvent(MEDICATIONS_STACK)).fingerprint,
    );
  });

  it("groups the same untagged fault identically after a rebuild renumbers its chunks", () => {
    const before = privacySafeErrorEvent(
      untaggedEvent(
        ["/app/.next/server/app/api/medications/route.js", "/app/.next/server/chunks/1261.js"],
        "d0.makeRequest",
      ),
    );
    const after = privacySafeErrorEvent(
      untaggedEvent(
        ["/app/.next/server/app/api/medications/route.js", "/app/.next/server/chunks/41261.js"],
        "gX.makeRequest",
      ),
    );

    expect(before.fingerprint).toEqual(after.fingerprint);
    expect(after.fingerprint).toEqual(["/api/medications", "Error", "unknown", "makeRequest"]);
  });

  it("falls back to one coarse bucket only when no frame names a route at all", () => {
    expect(privacySafeErrorEvent(untaggedEvent(TIMER_STACK)).fingerprint).toEqual([
      "unrouted",
      "Error",
      "unknown",
      "unknown",
    ]);
  });

  it("prefers the tag over the stack when both are present", () => {
    const event = untaggedEvent(MEDICATIONS_STACK);
    expect(privacySafeErrorEvent({ ...event, tags: { route_path: "/api/answer" } }).fingerprint?.[0]).toBe(
      "/api/answer",
    );
  });

  it("recovers a dynamic route as its pattern, never as a request value", () => {
    const fingerprint = privacySafeErrorEvent(
      untaggedEvent([
        "/app/.next/server/app/differentials/diagnoses/[slug]/page.js",
        "/app/.next/server/chunks/41261.js",
      ]),
    ).fingerprint;

    // The bundle path holds the literal segment Next compiled, so no patient- or query-derived
    // value can reach the fingerprint through this route.
    expect(fingerprint?.[0]).toBe("/differentials/diagnoses/[slug]");
  });
});

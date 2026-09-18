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
 * The normalisation above only ever reached events carrying a `route_path` tag, and only
 * `captureRequestError` sets one. Measured against the live project on 2026-09-17: 853 of the 857
 * error events in the preceding 30 days had no such tag, because almost everything reaches Sentry
 * through the SDK's own global handlers instead. Those events took an `undefined` fingerprint,
 * which hands grouping back to Sentry's default algorithm over exactly the minified frames these
 * helpers normalise — so the 2026-09-16 fix reached 0.5% of error events (the worker branch aside,
 * which already grouped by stage) and the rest kept splintering: 20 open issues under one title.
 *
 * Frame arrays are ordered oldest-first, so `at(-1)` is the innermost frame and the route bundle —
 * entered first — sits nearer the start. These fixtures preserve that order, and the API-route
 * stacks are the real ones from issues JAVASCRIPT-NEXTJS-26, -1W and -2G.
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
/**
 * The same stack after the SDK's `DistDirRewriteFrames` integration has run. `withSentryConfig`
 * installs it whenever source-map upload is configured, and it rewrites the absolute dist path to
 * `app:///_next` before `beforeSend` sees the frame.
 */
const REWRITTEN_MEDICATIONS_STACK = MEDICATIONS_STACK.map((filename) => filename.replace("/app/.next", "app:///_next"));
/** Every page in this app is compiled under the `(search-app)` route group. */
const PAGE_STACK = [
  "/app/.next/server/app/(search-app)/differentials/diagnoses/[slug]/page.js",
  "/app/.next/server/chunks/41261.js",
];
const TIMER_STACK = ["/app/.next/server/chunks/2985.js", "node:internal/timers", "/app/.next/server/chunks/41261.js"];
const PROVIDER_STACK = [
  "/app/node_modules/@supabase/postgrest-js/dist/cjs/index.js",
  "/app/.next/server/chunks/41261.js",
];
const OPAQUE_STACK = ["/app/.next/server/chunks/2985.js", "/app/.next/server/chunks/41261.js"];

describe("events that arrive with no route tag", () => {
  it("never hands grouping back to Sentry with an undefined fingerprint", () => {
    for (const stack of [DIFFERENTIALS_STACK, MEDICATIONS_STACK, PAGE_STACK, TIMER_STACK, OPAQUE_STACK]) {
      expect(privacySafeErrorEvent(untaggedEvent(stack)).fingerprint).toBeDefined();
    }
  });

  it("recovers the route pattern from the Next route bundle in the stack", () => {
    expect(privacySafeErrorEvent(untaggedEvent(DIFFERENTIALS_STACK)).fingerprint?.[0]).toBe("/api/differentials");
    expect(privacySafeErrorEvent(untaggedEvent(MEDICATIONS_STACK)).fingerprint?.[0]).toBe("/api/medications");
  });

  /**
   * REGRESSION GUARD, and the reason this file names the SDK internals. Enabling source-map upload
   * makes `withSentryConfig` install `DistDirRewriteFrames`, so every frame arrives as
   * `app:///_next/...` instead of `/app/.next/...`. A pattern matching only `.next` therefore works
   * until the day an operator supplies SENTRY_AUTH_TOKEN, and then sends every event to `unrouted`
   * silently — the Dockerfile half of this change disabling the scrubber half.
   */
  it("recovers the rewritten filename the SDK produces once source-map upload is enabled", () => {
    expect(privacySafeErrorEvent(untaggedEvent(REWRITTEN_MEDICATIONS_STACK)).fingerprint?.[0]).toBe("/api/medications");
  });

  it("groups a fault identically before and after source-map upload is enabled", () => {
    expect(privacySafeErrorEvent(untaggedEvent(REWRITTEN_MEDICATIONS_STACK)).fingerprint).toEqual(
      privacySafeErrorEvent(untaggedEvent(MEDICATIONS_STACK)).fingerprint,
    );
  });

  /**
   * A route group is a directory that Next compiles into the path but leaves out of the URL, and
   * `captureRequestError`'s tag leaves it out too — a live event on 2026-09-17 carried
   * `route_path: /differentials/diagnoses/[slug]` for this very page. Keeping the group would split
   * one fault into a tagged and an untagged group, which is the splintering this exists to remove.
   */
  it("drops the route group so the recovered pattern equals the tag Sentry would have set", () => {
    expect(privacySafeErrorEvent(untaggedEvent(PAGE_STACK)).fingerprint?.[0]).toBe("/differentials/diagnoses/[slug]");
  });

  it("maps a root page to /, with or without a route group", () => {
    for (const filename of ["/app/.next/server/app/page.js", "/app/.next/server/app/(search-app)/page.js"]) {
      expect(privacySafeErrorEvent(untaggedEvent([filename])).fingerprint?.[0]).toBe("/");
    }
  });

  it("drops a parallel-route slot segment", () => {
    expect(
      privacySafeErrorEvent(untaggedEvent(["/app/.next/server/app/dashboard/@analytics/page.js"])).fingerprint?.[0],
    ).toBe("/dashboard");
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

  /**
   * The `unrouted` bucket must not become one group for the whole application. Everything in
   * `src/lib/**` compiles to numbered chunks that collapse to `unknown`, and most error names
   * collapse to `Error`, so without a build-stable anchor every background fault would share one
   * fingerprint — trading splintering for the opposite failure, where a genuinely new fault joins
   * an existing noisy group instead of arriving as a new issue.
   */
  it("separates unrouted faults by the innermost build-stable frame", () => {
    const timer = privacySafeErrorEvent(untaggedEvent(TIMER_STACK)).fingerprint;
    const provider = privacySafeErrorEvent(untaggedEvent(PROVIDER_STACK)).fingerprint;

    expect(timer?.[1]).toBe("node:internal/timers");
    expect(provider?.[1]).toBe("/app/node_modules/@supabase/postgrest-js/dist/cjs/index.js");
    expect(timer).not.toEqual(provider);
  });

  it("falls back to a single coarse bucket only when no frame is build-stable at all", () => {
    expect(privacySafeErrorEvent(untaggedEvent(OPAQUE_STACK)).fingerprint).toEqual([
      "unrouted",
      "unknown",
      "Error",
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
    const fingerprint = privacySafeErrorEvent(untaggedEvent(PAGE_STACK)).fingerprint;

    // The bundle path holds the literal segment Next compiled, so no patient- or query-derived
    // value can reach the fingerprint through this route.
    expect(fingerprint?.[0]).toContain("[slug]");
    expect(JSON.stringify(fingerprint)).not.toMatch(/search-app/);
  });
});

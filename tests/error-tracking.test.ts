import { afterEach, describe, expect, it, vi } from "vitest";
import {
  privacySafeErrorEvent,
  privacySafeTransactionEvent,
  resolveTracesSampleRate,
} from "@/lib/observability/error-tracking";

describe("production error tracking privacy boundary", () => {
  it("removes clinical text, identifiers, request data, breadcrumbs, and frame locals", () => {
    const event = privacySafeErrorEvent({
      type: undefined,
      event_id: "event-1",
      message: "Jane Doe MRN 123456 reported suicidal thoughts",
      request: { url: "https://example.test/api/answer?q=Jane", headers: { authorization: "Bearer secret" } },
      user: { id: "owner-id", email: "jane@example.test" },
      breadcrumbs: [{ message: "patient query" }],
      contexts: { clinical: { answer: "private answer" } },
      extra: { prompt: "private prompt" },
      exception: {
        values: [
          {
            type: "JaneDoeMRN123456Error",
            value: "Jane Doe MRN 123456 reported suicidal thoughts",
            stacktrace: {
              frames: [
                {
                  filename: "src/app/api/answer/route.ts",
                  function: "POST",
                  lineno: 42,
                  colno: 7,
                  in_app: true,
                  vars: { query: "Jane Doe" },
                },
              ],
            },
          },
        ],
      },
      tags: { route_path: "/api/answer", patient_id: "owner-id" },
      fingerprint: ["Jane Doe", "123456"],
    });

    expect(JSON.stringify(event)).not.toMatch(/Jane|123456|suicidal|secret|owner-id|private prompt|private answer/);
    expect(event).not.toHaveProperty("request");
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("breadcrumbs");
    expect(event.exception?.values?.[0]).toMatchObject({
      type: "Error",
      value: "Unhandled server request error",
      stacktrace: { frames: [{ filename: "src/app/api/answer/route.ts", function: "POST", lineno: 42 }] },
    });
    expect(event.exception?.values?.[0].stacktrace?.frames?.[0]).not.toHaveProperty("vars");
    expect(event.tags).toEqual({ route_path: "/api/answer" });
    expect(event.fingerprint).toEqual(["/api/answer", "Error", "src/app/api/answer/route.ts", "POST"]);
  });

  it("initializeErrorTracking is a DSN/status probe and does not throw without Sentry", async () => {
    const { initializeErrorTracking } = await import("@/lib/observability/error-tracking");
    await expect(initializeErrorTracking()).resolves.toBeTypeOf("boolean");
  });
});

describe("resolveTracesSampleRate", () => {
  it("defaults to 0.1 and clamps invalid values", () => {
    expect(resolveTracesSampleRate(undefined)).toBe(0.1);
    expect(resolveTracesSampleRate("")).toBe(0.1);
    expect(resolveTracesSampleRate("0")).toBe(0);
    expect(resolveTracesSampleRate("0.25")).toBe(0.25);
    expect(resolveTracesSampleRate("1")).toBe(1);
    expect(resolveTracesSampleRate("2")).toBe(0.1);
    expect(resolveTracesSampleRate("nope")).toBe(0.1);
  });
});

describe("privacySafeTransactionEvent", () => {
  it("keeps table/operation DB span metadata and strips query filters, bodies, and request data", () => {
    const event = privacySafeTransactionEvent({
      type: "transaction",
      event_id: "txn-1",
      transaction: "/api/answer",
      request: { url: "https://example.test/api/answer?q=Jane%20Doe" },
      user: { id: "owner-id", email: "jane@example.test" },
      breadcrumbs: [{ message: "eq(owner_id, owner-id)", category: "db.select" }],
      tags: { route_path: "/api/answer", patient_id: "owner-id" },
      contexts: {
        trace: {
          trace_id: "trace-1",
          span_id: "span-root",
          op: "http.server",
          data: { "http.query": "q=Jane Doe MRN 123456" },
        },
      },
      spans: [
        {
          span_id: "span-db",
          trace_id: "trace-1",
          op: "db",
          origin: "auto.db.supabase",
          description: "select eq(owner_id, owner-secret) from(documents)",
          start_timestamp: 1,
          timestamp: 1.2,
          data: {
            "db.table": "documents",
            "db.schema": "public",
            "db.system": "postgresql",
            "db.operation": "select",
            "db.sdk": "supabase-js-node/2.0.0",
            "db.url": "https://sjrfecxgysukkwxsowpy.supabase.co",
            "db.query": ["eq(owner_id, owner-secret)", "ilike(title, %Jane Doe%)"],
            // Cast: SDK may attach object bodies at runtime when sendOperationData is on.
            "db.body": { title: "clinical note about Jane" } as unknown as string[],
            "sentry.op": "db",
            "sentry.origin": "auto.db.supabase",
          },
        },
      ],
    });

    expect(JSON.stringify(event)).not.toMatch(/Jane|owner-secret|owner-id|clinical note|123456/);
    expect(event).not.toHaveProperty("request");
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("breadcrumbs");
    expect(event.transaction).toBe("/api/answer");
    expect(event.tags).toEqual({ route_path: "/api/answer" });
    expect(event.spans?.[0]).toMatchObject({
      description: "select from(documents)",
      data: {
        "db.table": "documents",
        "db.schema": "public",
        "db.system": "postgresql",
        "db.operation": "select",
        "db.sdk": "supabase-js-node/2.0.0",
        "sentry.op": "db",
        "sentry.origin": "auto.db.supabase",
      },
    });
    expect(event.spans?.[0]?.data).not.toHaveProperty("db.query");
    expect(event.spans?.[0]?.data).not.toHaveProperty("db.body");
    expect(event.spans?.[0]?.data).not.toHaveProperty("db.url");
    expect(event.contexts?.trace?.data).toBeUndefined();
  });
});

describe("instrumentSupabaseClientForTracing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is a no-op when SENTRY_DSN is unset", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { instrumentSupabaseClientForTracing } = await import("@/lib/observability/error-tracking");
    expect(() => instrumentSupabaseClientForTracing({})).not.toThrow();
  });
});

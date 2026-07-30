import { describe, expect, it } from "vitest";
import { privacySafeErrorEvent } from "@/lib/observability/error-tracking";

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
            type: "ProviderError",
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
      tags: { route_path: "/api/answer" },
    });

    expect(JSON.stringify(event)).not.toMatch(/Jane|123456|suicidal|secret|owner-id|private prompt|private answer/);
    expect(event).not.toHaveProperty("request");
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("breadcrumbs");
    expect(event.exception?.values?.[0]).toMatchObject({
      type: "ProviderError",
      value: "Unhandled server request error",
      stacktrace: { frames: [{ filename: "src/app/api/answer/route.ts", function: "POST", lineno: 42 }] },
    });
    expect(event.exception?.values?.[0].stacktrace?.frames?.[0]).not.toHaveProperty("vars");
  });
});

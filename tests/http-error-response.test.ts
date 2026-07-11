import { describe, expect, it } from "vitest";
import { jsonError, PublicApiError } from "../src/lib/http";

describe("jsonError public payload", () => {
  it("keeps public error payloads stable without exposing stack or internal causes", async () => {
    const error = new PublicApiError("Search failed safely.", 503, {
      code: "search_unavailable",
      requestId: "req_123",
      causeName: "DatabaseError",
      causeMessage: "select failed at /private/path",
      sqlState: "PGRST500",
    });
    error.stack = "PublicApiError: Search failed safely.\n    at secret.ts:1:1";

    const response = jsonError(error);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Search failed safely.",
      message: "Search failed safely.",
      code: "search_unavailable",
      requestId: "req_123",
    });
    expect(JSON.stringify(body)).not.toMatch(/stack|causeName|causeMessage|sqlState|secret\.ts|private\/path/i);
  });

  it("uses a generic message for unexpected server errors", async () => {
    const error = new Error("database password leaked in thrown message");
    error.stack = "Error: database password leaked in thrown message\n    at route.ts:1:1";

    const response = jsonError(error, 500);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Request failed.",
      message: "Request failed.",
      code: "internal_error",
    });
  });
});

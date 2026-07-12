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

  it("only returns stable snake_case error codes and falls back to status-based codes for invalid codes", async () => {
    // Valid stable code
    const validError = new PublicApiError("Valid code error", 400, { code: "valid_error_code" });
    const validResponse = jsonError(validError);
    const validBody = await validResponse.json();
    expect(validBody.code).toBe("valid_error_code");

    // Invalid code: arbitrary class name like TypeError
    const typeError = new PublicApiError("Type error", 500, { code: "TypeError" });
    const typeErrorResponse = jsonError(typeError);
    const typeErrorBody = await typeErrorResponse.json();
    expect(typeErrorBody.code).toBe("internal_error");

    // Invalid code: contains uppercase
    const uppercaseError = new PublicApiError("Uppercase code", 400, { code: "InvalidCode" });
    const uppercaseResponse = jsonError(uppercaseError);
    const uppercaseBody = await uppercaseResponse.json();
    expect(uppercaseBody.code).toBe("request_failed");

    // Invalid code: contains spaces
    const spaceError = new PublicApiError("Space code", 400, { code: "invalid code" });
    const spaceResponse = jsonError(spaceError);
    const spaceBody = await spaceResponse.json();
    expect(spaceBody.code).toBe("request_failed");

    // Invalid code: contains hyphen instead of underscore
    const hyphenError = new PublicApiError("Hyphen code", 400, { code: "invalid-code" });
    const hyphenResponse = jsonError(hyphenError);
    const hyphenBody = await hyphenResponse.json();
    expect(hyphenBody.code).toBe("request_failed");

    // Invalid code: starts with number
    const numberError = new PublicApiError("Number start", 400, { code: "5xx_error" });
    const numberResponse = jsonError(numberError);
    const numberBody = await numberResponse.json();
    expect(numberBody.code).toBe("request_failed");

    // Invalid code: empty string
    const emptyError = new PublicApiError("Empty code", 400, { code: "" });
    const emptyResponse = jsonError(emptyError);
    const emptyBody = await emptyResponse.json();
    expect(emptyBody.code).toBe("request_failed");
  });
});

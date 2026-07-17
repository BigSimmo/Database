import { describe, expect, it, vi } from "vitest";

import { rateLimitJsonResponse } from "../src/lib/api-rate-limit";
import { jsonError } from "../src/lib/http";
import { unauthorizedResponse } from "../src/lib/supabase/auth";

describe("private API error cache policy", () => {
  it("marks validation, authentication, and rate-limit responses private", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const validation = jsonError("Invalid request.", 400);
    const unauthorized = unauthorizedResponse();
    const limited = rateLimitJsonResponse("Too many requests.", {
      limited: true,
      limit: 1,
      remaining: 0,
      retryAfterSeconds: 60,
      resetAt: new Date(60_000).toISOString(),
    });

    expect(validation.headers.get("Cache-Control")).toBe("private, no-store");
    expect(unauthorized.headers.get("Cache-Control")).toBe("private, no-store");
    expect(limited.headers.get("Cache-Control")).toBe("private, no-store");
    expect(limited.headers.get("Retry-After")).toBe("60");
  });
});

import { describe, expect, it } from "vitest";

import { mapOpenAIError } from "@/lib/openai";
import { PublicApiError } from "@/lib/http";

function openAIError(message: string, extra: { status?: number; code?: string }) {
  return Object.assign(new Error(message), extra);
}

describe("mapOpenAIError quota vs rate-limit classification", () => {
  it("treats 429 insufficient_quota as a non-retriable, source-only fallback (not 'retry in a moment')", () => {
    const mapped = mapOpenAIError(
      openAIError("You exceeded your current quota, please check your plan and billing details.", {
        status: 429,
        code: "insufficient_quota",
      }),
      "answer",
    );

    expect(mapped).toBeInstanceOf(PublicApiError);
    expect(mapped.status).toBe(429);
    expect(mapped.details?.code).toBe("insufficient_quota");
    expect(mapped.message.toLowerCase()).toContain("quota");
    expect(mapped.message).not.toMatch(/retry in a moment/i);
  });

  it("detects quota exhaustion from the message even when no error code is set", () => {
    const mapped = mapOpenAIError(openAIError("Billing hard limit reached.", { status: 429 }), "answer");

    expect(mapped.details?.code).toBe("insufficient_quota");
    expect(mapped.message).not.toMatch(/retry in a moment/i);
  });

  it("still treats a transient rate limit as retriable", () => {
    const mapped = mapOpenAIError(
      openAIError("Rate limit reached for requests.", { status: 429, code: "rate_limit_exceeded" }),
      "answer",
    );

    expect(mapped.status).toBe(429);
    expect(mapped.message).toMatch(/retry in a moment/i);
    expect(mapped.details?.code).toBe("rate_limit_exceeded");
  });

  it("maps auth failures to a 500 configuration error", () => {
    const mapped = mapOpenAIError(openAIError("Incorrect API key provided.", { status: 401 }), "answer");
    expect(mapped.status).toBe(500);
    expect(mapped.message.toLowerCase()).toContain("authentication");
  });

  it("maps timeouts to a 504 source-only fallback signal", () => {
    const mapped = mapOpenAIError(openAIError("Request timed out.", { code: "ETIMEDOUT" }), "answer");
    expect(mapped.status).toBe(504);
  });
});

import { describe, expect, it } from "vitest";
import { redactLogContext } from "../src/lib/logger";

describe("redactLogContext", () => {
  it("redacts values under sensitive keys", () => {
    const out = redactLogContext({
      status: 500,
      authorization: "Bearer secret-token",
      serviceRoleKey: "sb_secret_abc",
      email: "patient@example.com",
      query: "56yo male with psychosis on 12mg haloperidol",
      answer: "clinical answer text",
      name: "Error",
    });

    expect(out.status).toBe(500);
    expect(out.name).toBe("Error");
    expect(out.authorization).toBe("[redacted]");
    expect(out.serviceRoleKey).toBe("[redacted]");
    expect(out.email).toBe("[redacted]");
    expect(out.query).toBe("[redacted]");
    expect(out.answer).toBe("[redacted]");
  });

  it("redacts nested sensitive keys", () => {
    const out = redactLogContext({ details: { apiKey: "k", code: "P0001" } }) as {
      details: Record<string, unknown>;
    };
    expect(out.details.apiKey).toBe("[redacted]");
    expect(out.details.code).toBe("P0001");
  });

  it("truncates very long strings", () => {
    const out = redactLogContext({ stack: "x".repeat(2000) });
    expect(String(out.stack)).toContain("[truncated]");
    expect(String(out.stack).length).toBeLessThan(600);
  });

  it("serializes Error values to name and message", () => {
    const out = redactLogContext({ cause: new Error("boom") }) as { cause: Record<string, unknown> };
    expect(out.cause).toMatchObject({ name: "Error", message: "boom" });
  });
});

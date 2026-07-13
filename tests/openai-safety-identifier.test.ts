import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("OpenAI safety identifiers", () => {
  it("returns a stable HMAC without exposing the owner ID", async () => {
    vi.stubEnv("OPENAI_SAFETY_IDENTIFIER_SECRET", "test-secret-that-is-at-least-thirty-two-characters");
    const { openAISafetyIdentifier } = await import("../src/lib/openai");

    const first = openAISafetyIdentifier("2dfb60cb-cc8b-48fd-865d-428227fbda89");
    const second = openAISafetyIdentifier("2dfb60cb-cc8b-48fd-865d-428227fbda89");
    const other = openAISafetyIdentifier("6f26191c-5ce1-42e1-8e59-00312dff0d99");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).not.toContain("2dfb60cb");
  });

  it("omits the identifier for anonymous requests or unconfigured deployments", async () => {
    const { openAISafetyIdentifier } = await import("../src/lib/openai");
    expect(openAISafetyIdentifier(undefined)).toBeUndefined();
    expect(openAISafetyIdentifier("owner-id")).toBeUndefined();
  });
});

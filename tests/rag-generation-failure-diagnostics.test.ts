import { describe, expect, it } from "vitest";

import { generationFailureDetailToken } from "@/lib/rag/rag-generation-failure-diagnostics";

describe("generationFailureDetailToken", () => {
  it("returns only the stable gate or incomplete-generation token", () => {
    expect(generationFailureDetailToken(new Error("OpenAI generation quality gate failed: provider_source_gap"))).toBe(
      "provider_source_gap",
    );
    expect(generationFailureDetailToken(new Error("OpenAI generation incomplete: max_output_tokens"))).toBe(
      "max_output_tokens",
    );
    expect(generationFailureDetailToken(new Error("network unavailable"))).toBeNull();
  });
});

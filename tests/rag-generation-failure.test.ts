import { describe, expect, it } from "vitest";
import {
  generationQualityRetryInstruction,
  summarizeGenerationFailureReason,
} from "../src/lib/rag/rag-generation-failure";

describe("generation failure diagnostics", () => {
  it("preserves an allowlisted deterministic quality-gate reason", () => {
    expect(
      summarizeGenerationFailureReason(new Error("OpenAI generation quality gate failed: missing_query_intent")),
    ).toBe("generation_quality_failed_missing_query_intent");
  });

  it("preserves an allowlisted post-finalization quality-gate reason", () => {
    expect(
      summarizeGenerationFailureReason(new Error("OpenAI generation quality gate failed: numeric_faithfulness_gap")),
    ).toBe("generation_quality_failed_numeric_faithfulness_gap");
  });

  it("does not confuse an incomplete-opening quality gate with provider truncation", () => {
    expect(
      summarizeGenerationFailureReason(new Error("OpenAI generation quality gate failed: incomplete_opening_sentence")),
    ).toBe("generation_quality_failed_incomplete_opening_sentence");
  });

  it("does not expose an unknown quality-gate message", () => {
    expect(
      summarizeGenerationFailureReason(
        new Error("OpenAI generation quality gate failed: incomplete private patient details"),
      ),
    ).toBe("generation_quality_failed");
  });

  it("keeps provider failure classification unchanged", () => {
    expect(summarizeGenerationFailureReason(new Error("OpenAI provider timed out"))).toBe("provider_timeout");
  });

  it("adds a bounded numeric-faithfulness repair instruction", () => {
    const instruction = generationQualityRetryInstruction("numeric_faithfulness_gap");

    expect(instruction).toContain("exact digits and unit appear in the cited source excerpt");
    expect(instruction).toContain("Do not infer, convert, calculate, round, or combine figures");
    expect(instruction).toContain("numeric_faithfulness_gap");
  });
});

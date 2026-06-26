import { describe, expect, it } from "vitest";
import {
  looksLikeJsonArtifact,
  sanitizeAnswerText,
  sanitizeStructuredText,
  splitBalancedWords,
} from "../src/lib/rag-answer-text";

describe("RAG answer text helpers", () => {
  it("normalizes balanced word tokens for query/source matching", () => {
    expect(splitBalancedWords("Clozapine: red-range blood results!")).toEqual([
      "clozapine",
      "red",
      "range",
      "blood",
      "results",
    ]);
  });

  it("detects structured-output fragments as display artifacts", () => {
    expect(
      looksLikeJsonArtifact('{"answer":"Use monitoring","citations":[{"chunk_id":"chunk-1"}],"confidence":"high"}'),
    ).toBe(true);
    expect(looksLikeJsonArtifact("Use clozapine monitoring forms during initiation.")).toBe(false);
  });

  it("strips leading schema keys and rejects JSON fragments", () => {
    expect(sanitizeStructuredText("body: Complete the Clozapine Monitoring Form.", { minTokens: 3 })).toBe(
      "Complete the Clozapine Monitoring Form.",
    );
    expect(sanitizeStructuredText('{"heading":"Monitoring","body":"Complete the form"}', { minTokens: 2 })).toBe("");
  });

  it("keeps clinically useful answer text with the stricter answer threshold", () => {
    expect(sanitizeAnswerText("Complete baseline monitoring before clozapine initiation.")).toBe(
      "Complete baseline monitoring before clozapine initiation.",
    );
    expect(sanitizeAnswerText("OK")).toBe("");
  });
});

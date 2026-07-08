import { describe, expect, it } from "vitest";
import {
  answerPayloadIsUsable,
  classifyAnswerError,
  isRetryableError,
  keywordQueryFromNaturalLanguage,
  makeSearchError,
  progressForRetry,
} from "@/components/clinical-dashboard/search-utils";
import type { RagAnswer } from "@/lib/types";

function answer(overrides: Partial<RagAnswer> = {}): RagAnswer {
  return {
    answer: "Use linked sources to verify the clinical point.",
    grounded: true,
    confidence: "medium",
    citations: [],
    sources: [],
    ...overrides,
  };
}

describe("clinical dashboard search utilities", () => {
  it("converts natural-language fallback queries into deduplicated keywords", () => {
    expect(
      keywordQueryFromNaturalLanguage("What clozapine monitoring items are shown in the clozapine table image?"),
    ).toBe("what clozapine monitoring items shown table image");
  });

  it("keeps unsupported answers usable only when they carry gap context", () => {
    expect(answerPayloadIsUsable(answer({ confidence: "unsupported" }))).toBe(false);
    expect(
      answerPayloadIsUsable(
        answer({
          confidence: "unsupported",
          relatedDocuments: [
            {
              document_id: "doc-1",
              title: "Synthetic guideline",
              file_name: "synthetic.pdf",
              labels: [],
              summary: null,
              best_pages: [1],
              best_chunk_ids: ["chunk-1"],
              image_count: 0,
              match_reason: "Closest related source for an unsupported query.",
              score: 0.7,
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("classifies retryable search errors", () => {
    expect(isRetryableError(makeSearchError("Service is currently unavailable.", 503, true))).toBe(true);
    expect(isRetryableError(makeSearchError("Search request was not authorized by the server.", 401))).toBe(false);
  });

  it("formats retry progress without exposing impossible counts", () => {
    expect(progressForRetry(1)).toBe("Retrying...");
    expect(progressForRetry(10)).toBe("Retrying... (2/2)");
  });

  it("classifies a 404 as a calm no-results outcome and everything else as a retryable failure", () => {
    // The executor uses makeSearchError("No usable results were found.", 404, false) as the empty-result sentinel.
    expect(classifyAnswerError(makeSearchError("No usable results were found.", 404, false))).toBe("no-results");
    expect(classifyAnswerError(makeSearchError("Answer generation failed.", 500, true))).toBe("failure");
    expect(classifyAnswerError(makeSearchError("Search request was not authorized by the server.", 401))).toBe(
      "failure",
    );
    // Bare network TypeError and unknown non-error values must never masquerade as no-results.
    expect(classifyAnswerError(new TypeError("Failed to fetch"))).toBe("failure");
    expect(classifyAnswerError(new Error("Search failed"))).toBe("failure");
    expect(classifyAnswerError(null)).toBe("failure");
    expect(classifyAnswerError("boom")).toBe("failure");
  });
});

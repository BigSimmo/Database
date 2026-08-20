import { describe, expect, it } from "vitest";

import { analyzeClinicalQuery } from "@/lib/clinical-search";
import {
  isUnsupportedSoftTailAnalysis,
  shouldSkipUnsupportedSoftTailAnswerCacheWrite,
  shouldSkipUnsupportedSoftTailCacheWrite,
} from "@/lib/rag/rag-query-guard";

describe("shouldSkipUnsupportedSoftTailCacheWrite", () => {
  it("skips only when a classifier could have decided a soft-tail inconclusive zero", () => {
    const query = "catatonia";
    const analysis = { ...analyzeClinicalQuery(query), corpusGrounding: "inconclusive" as const };
    expect(isUnsupportedSoftTailAnalysis(query, analysis)).toBe(true);

    expect(
      shouldSkipUnsupportedSoftTailCacheWrite(query, analysis, {
        openAiApiKeyPresent: true,
      }),
    ).toBe(true);
  });

  it("does not skip when no classifier is reachable", () => {
    const query = "catatonia";
    const analysis = { ...analyzeClinicalQuery(query), corpusGrounding: "inconclusive" as const };

    expect(
      shouldSkipUnsupportedSoftTailCacheWrite(query, analysis, {
        openAiApiKeyPresent: false,
      }),
    ).toBe(false);
  });

  it("does not skip a deterministic out_of_corpus zero even with a key present", () => {
    const query = "catatonia";
    const analysis = { ...analyzeClinicalQuery(query), corpusGrounding: "out_of_corpus" as const };
    expect(isUnsupportedSoftTailAnalysis(query, analysis)).toBe(true);

    expect(
      shouldSkipUnsupportedSoftTailCacheWrite(query, analysis, {
        openAiApiKeyPresent: true,
      }),
    ).toBe(false);
  });

  it("does not skip deterministic exclusion patterns outside the soft-tail bucket", () => {
    const query = "Show me the newly uploaded guideline";
    const analysis = analyzeClinicalQuery(query);
    expect(isUnsupportedSoftTailAnalysis(query, analysis)).toBe(false);

    expect(
      shouldSkipUnsupportedSoftTailCacheWrite(query, analysis, {
        openAiApiKeyPresent: true,
        corpusGrounding: "inconclusive",
      }),
    ).toBe(false);
  });

  it("honours an explicit corpusGrounding override over analysis.corpusGrounding", () => {
    const query = "catatonia";
    const analysis = { ...analyzeClinicalQuery(query), corpusGrounding: "inconclusive" as const };

    expect(
      shouldSkipUnsupportedSoftTailCacheWrite(query, analysis, {
        openAiApiKeyPresent: true,
        corpusGrounding: "out_of_corpus",
      }),
    ).toBe(false);
  });

  it("skips the answer-cache write only for empty unsupported_short_circuit soft-tail zeros", () => {
    const query = "catatonia";
    const analysis = analyzeClinicalQuery(query);

    expect(
      shouldSkipUnsupportedSoftTailAnswerCacheWrite({
        resultCount: 0,
        retrievalStrategy: "unsupported_short_circuit",
        query,
        analysis,
        openAiApiKeyPresent: true,
        corpusGrounding: "inconclusive",
      }),
    ).toBe(true);
    expect(
      shouldSkipUnsupportedSoftTailAnswerCacheWrite({
        resultCount: 1,
        retrievalStrategy: "unsupported_short_circuit",
        query,
        analysis,
        openAiApiKeyPresent: true,
        corpusGrounding: "inconclusive",
      }),
    ).toBe(false);
    expect(
      shouldSkipUnsupportedSoftTailAnswerCacheWrite({
        resultCount: 0,
        retrievalStrategy: "text_fast_path",
        query,
        analysis,
        openAiApiKeyPresent: true,
        corpusGrounding: "inconclusive",
      }),
    ).toBe(false);
  });
});

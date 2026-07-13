import { describe, expect, it } from "vitest";
import {
  answerGenerationFingerprint,
  buildAnswerGenerationFingerprint,
  scopedAnswerCacheKey,
  type AnswerGenerationFingerprintInput,
} from "../src/lib/rag-cache";

const baseline: AnswerGenerationFingerprintInput = {
  answerModel: "gpt-5.6-terra",
  fastModel: "gpt-5.6-terra",
  strongModel: "gpt-5.6-sol",
  classifierModel: "gpt-5.6-luna",
  indexingModel: "gpt-5.6-terra",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
  fastReasoningEffort: "low",
  strongReasoningEffort: "high",
  answerVerbosity: "medium",
  maxOutputTokens: 4000,
  providerMode: "auto",
  promptVersion: "clinical-rag-answer-v18",
  schemaVersion: "clinical-rag-answer-schema-v3",
  classifierPromptVersion: "clinical-rag-query-classifier-v1",
  retrievalVersion: "deep-memory-v1",
  indexingPromptVersion: "clinical-indexing-prompts-v1",
};

describe("RAG answer generation fingerprints", () => {
  it.each([
    ["fast model", { fastModel: "gpt-5.6-luna" }],
    ["classifier model", { classifierModel: "gpt-5.6-terra" }],
    ["indexing model", { indexingModel: "gpt-5.6-sol" }],
    ["embedding model", { embeddingModel: "text-embedding-3-large" }],
    ["embedding dimensions", { embeddingDimensions: 3072 }],
    ["strong reasoning", { strongReasoningEffort: "medium" }],
    ["answer verbosity", { answerVerbosity: "low" }],
    ["maximum output tokens", { maxOutputTokens: 6000 }],
    ["provider mode", { providerMode: "offline" }],
    ["prompt version", { promptVersion: "clinical-rag-answer-v19" }],
    ["schema version", { schemaVersion: "clinical-rag-answer-schema-v4" }],
    ["classifier prompt version", { classifierPromptVersion: "clinical-rag-query-classifier-v2" }],
    ["retrieval version", { retrievalVersion: "deep-memory-v2" }],
    ["indexing prompt version", { indexingPromptVersion: "clinical-indexing-prompts-v2" }],
  ])("changes when %s changes", (_label, override) => {
    expect(buildAnswerGenerationFingerprint({ ...baseline, ...override })).not.toBe(
      buildAnswerGenerationFingerprint(baseline),
    );
  });

  it("is stable for the same generation configuration", () => {
    expect(buildAnswerGenerationFingerprint({ ...baseline })).toBe(buildAnswerGenerationFingerprint(baseline));
  });

  it("is included in the scoped answer cache key", () => {
    expect(scopedAnswerCacheKey({ query: "Clozapine monitoring", ownerId: "owner-a" })).toContain(
      `generation:${answerGenerationFingerprint()}`,
    );
  });
});

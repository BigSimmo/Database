import { describe, expect, it } from "vitest";

import { buildAnswerFollowUpQuery, buildAnswerFollowUpSuggestions } from "@/lib/answer-follow-up";

describe("buildAnswerFollowUpQuery", () => {
  it("returns the follow-up unchanged when there is no prior question", () => {
    expect(buildAnswerFollowUpQuery(undefined, "what about renal impairment?")).toBe("what about renal impairment?");
    expect(buildAnswerFollowUpQuery("", "what about renal impairment?")).toBe("what about renal impairment?");
  });

  it("wraps a short ambiguous follow-up with the prior question", () => {
    expect(buildAnswerFollowUpQuery("lithium dosing", "what about renal impairment?")).toBe(
      'Follow-up to "lithium dosing": what about renal impairment?',
    );
  });

  it("wraps pronoun-style continuations", () => {
    expect(buildAnswerFollowUpQuery("clozapine monitoring", "is it safe in pregnancy?")).toBe(
      'Follow-up to "clozapine monitoring": is it safe in pregnancy?',
    );
  });

  it("does not wrap a follow-up that restates the prior topic", () => {
    expect(buildAnswerFollowUpQuery("lithium dosing", "lithium levels in the elderly")).toBe(
      "lithium levels in the elderly",
    );
  });

  it("does not wrap a long self-contained follow-up", () => {
    const longQuestion =
      "What baseline investigations are required before starting sodium valproate in a woman of childbearing age?";
    expect(buildAnswerFollowUpQuery("lithium dosing", longQuestion)).toBe(longQuestion);
  });

  it("does not wrap a short question on a clearly new topic without continuation cues", () => {
    expect(buildAnswerFollowUpQuery("lithium dosing", "clozapine baseline bloods")).toBe("clozapine baseline bloods");
  });

  it("keeps the wrapped query within the 2000-char API limit", () => {
    const longPrior = "a".repeat(2100);
    const result = buildAnswerFollowUpQuery(longPrior, "what about them?");
    expect(result.length).toBeLessThanOrEqual(2000);
    expect(result).toContain("what about them?");
  });

  it("trims whitespace before deciding", () => {
    expect(buildAnswerFollowUpQuery("  lithium dosing  ", "  what about the elderly?  ")).toBe(
      'Follow-up to "lithium dosing": what about the elderly?',
    );
  });
});

describe("buildAnswerFollowUpSuggestions", () => {
  const medicationAnswer = {
    answer: "Start low and monitor levels.",
    grounded: true,
    confidence: "high",
    citations: [],
    sources: [],
    queryClass: "medication_dose_risk",
    queryAnalysis: {
      originalQuery: "lithium dosing",
      normalizedQuery: "lithium dosing",
      queryClass: "medication_dose_risk",
      intent: "drug_dosing",
      confidence: 0.9,
      reasons: [],
      canonicalTerms: ["lithium"],
      expandedTerms: [],
      typoCorrections: [],
      medications: ["lithium"],
      acronyms: [],
      thresholdTerms: [],
      documentTitleTerms: [],
      queryRewrite: {
        normalizedQuery: "lithium dosing",
        searchQuery: "lithium dosing",
        expansions: [],
        reasons: [],
      },
      documentTitleIntent: false,
      comparisonIntent: false,
      freshnessNeed: false,
      needsVisualEvidence: false,
      needsSynthesis: false,
      needsClassifierFallback: false,
    },
  } satisfies import("@/lib/types").RagAnswer;

  it("returns medication follow-up suggestions for the latest turn", () => {
    const suggestions = buildAnswerFollowUpSuggestions("lithium dosing", medicationAnswer);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((item) => /renal impairment/i.test(item))).toBe(true);
  });

  it("avoids repeating questions already asked in the thread", () => {
    const suggestions = buildAnswerFollowUpSuggestions("lithium dosing", medicationAnswer, [
      "lithium dosing",
      "What about renal impairment?",
    ]);
    expect(suggestions.some((item) => /renal impairment/i.test(item))).toBe(false);
  });

  it("anchors suggestion topics on the opening question after a short follow-up turn", () => {
    const answerWithoutMedicationHint = {
      ...medicationAnswer,
      queryAnalysis: {
        ...medicationAnswer.queryAnalysis,
        medications: [],
      },
    } satisfies import("@/lib/types").RagAnswer;

    const suggestions = buildAnswerFollowUpSuggestions("what about renal impairment?", answerWithoutMedicationHint, [
      "lithium dosing",
      "what about renal impairment?",
    ]);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((item) => !/for what about renal impairment/i.test(item))).toBe(true);
    expect(suggestions.some((item) => /lithium dosing|What monitoring is required\?/i.test(item))).toBe(true);
  });

  it("uses a concise topic label for long first-turn questions", () => {
    const clozapineQuestion = "What clozapine monitoring items are shown in the table image?";
    const tableAnswer = {
      answer: "The synthetic clozapine table image highlights core monitoring domains.",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [],
      queryClass: "document_lookup",
      queryAnalysis: {
        ...medicationAnswer.queryAnalysis,
        originalQuery: clozapineQuestion,
        normalizedQuery: clozapineQuestion,
        queryClass: "document_lookup",
        medications: [],
        canonicalTerms: [],
      },
    } satisfies import("@/lib/types").RagAnswer;

    const suggestions = buildAnswerFollowUpSuggestions(clozapineQuestion, tableAnswer, [clozapineQuestion]);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((item) => !/for What clozapine monitoring items/i.test(item))).toBe(true);
    expect(suggestions.some((item) => /clozapine/i.test(item))).toBe(true);
  });
});

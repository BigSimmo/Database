import { describe, expect, it } from "vitest";

import {
  completeExtractiveSentence,
  generatedAnswerQualityFailureReason,
  isBareDefinitionQuestion,
  sourceBackedGenerationTimeoutAnswer,
  strongReasoningEffortForQueryClass,
} from "../src/lib/rag";
import { hasClinicalAnswerQualityIssue } from "../src/lib/rag-answer-text";
import type { RagAnswer, RagQueryClass } from "../src/lib/types";

function modelAnswer(overrides: Partial<RagAnswer> = {}): RagAnswer {
  return {
    answer: "",
    grounded: true,
    confidence: "high",
    citations: [],
    sources: [],
    routingMode: "fast",
    ...overrides,
  };
}

describe("responsiveness gate — model-answer core-term overlap (P3)", () => {
  it("flags an off-target model answer to a simple direct (non-definition) question", () => {
    const reason = generatedAnswerQualityFailureReason(
      modelAnswer({
        answer: "Sertraline is commenced at 50 mg daily and titrated to response over several weeks.",
      }),
      "When is clozapine given?",
      "unsupported_or_general" satisfies RagQueryClass,
    );
    expect(reason).toBe("missing_query_overlap");
  });

  it("does NOT flag a bare-definition answer that uses anaphora instead of repeating the entity", () => {
    // "What is …" answers legitimately say "It is …" without repeating the subject term.
    const reason = generatedAnswerQualityFailureReason(
      modelAnswer({
        answer:
          "It is a movement disorder characterised by an inability to remain still and a subjective sense of restlessness.",
      }),
      "What is akathisia?",
      "unsupported_or_general" satisfies RagQueryClass,
    );
    expect(reason).not.toBe("missing_query_overlap");
  });

  it("does NOT enforce lexical overlap on a broad/paraphrased management answer", () => {
    const reason = generatedAnswerQualityFailureReason(
      modelAnswer({
        answer: "First-line pharmacotherapy is an SSRI such as sertraline, combined with psychological therapy.",
      }),
      "How is depression managed?",
      "broad_summary" satisfies RagQueryClass,
    );
    expect(reason).not.toBe("missing_query_overlap");
  });

  it("still keeps the answer that actually addresses a simple direct question", () => {
    const reason = generatedAnswerQualityFailureReason(
      modelAnswer({
        answer: "Clozapine is given orally once daily, started low and titrated up over the first two weeks.",
      }),
      "When is clozapine given?",
      "unsupported_or_general" satisfies RagQueryClass,
    );
    expect(reason).not.toBe("missing_query_overlap");
  });
});

describe("broad document-answer citation coverage", () => {
  it("rejects a one-citation synthesis when a broad requirements question has multiple source chunks", () => {
    const reason = generatedAnswerQualityFailureReason(
      modelAnswer({
        answer:
          "A patient safety plan should identify warning signs, agreed crisis actions, and the people responsible for those actions.",
        citations: [{ chunk_id: "safety-plan-actions" }] as RagAnswer["citations"],
        sources: [{ id: "safety-plan-actions" }, { id: "safety-plan-review" }] as RagAnswer["sources"],
      }),
      "What should a patient safety plan include?",
      "document_lookup" satisfies RagQueryClass,
    );

    expect(reason).toBe("insufficient_broad_citation_coverage");
  });

  it("allows a single directly supporting chunk when no second source chunk is available", () => {
    const reason = generatedAnswerQualityFailureReason(
      modelAnswer({
        answer:
          "A patient safety plan should identify warning signs, agreed crisis actions, and the people responsible for those actions.",
        citations: [{ chunk_id: "safety-plan-actions" }] as RagAnswer["citations"],
        sources: [{ id: "safety-plan-actions" }] as RagAnswer["sources"],
      }),
      "What should a patient safety plan include?",
      "document_lookup" satisfies RagQueryClass,
    );

    expect(reason).toBeNull();
  });
});

describe("isBareDefinitionQuestion (P3 guard)", () => {
  it("recognises definitional phrasings", () => {
    expect(isBareDefinitionQuestion("What is akathisia?")).toBe(true);
    expect(isBareDefinitionQuestion("What's clozapine?")).toBe(true);
    expect(isBareDefinitionQuestion("Define serotonin syndrome")).toBe(true);
    expect(isBareDefinitionQuestion("Who is the responsible prescriber?")).toBe(true);
  });

  it("does not treat yes/no or when/where questions as definitions", () => {
    expect(isBareDefinitionQuestion("When is clozapine given?")).toBe(false);
    expect(isBareDefinitionQuestion("Does lithium cause tremor?")).toBe(false);
    expect(isBareDefinitionQuestion("Where is the monitoring recorded?")).toBe(false);
  });
});

describe("generation-timeout fallback wording (P2)", () => {
  it("reads as a plain-English source pointer, not telemetry-speak", () => {
    const text = sourceBackedGenerationTimeoutAnswer("What is the clozapine ANC threshold?");
    expect(text).toContain("cited below");
    expect(text).toMatch(/review them directly/i);
    expect(text).toContain("document passages");
    // The wording the task explicitly wants eliminated.
    expect(text).not.toMatch(/source status/i);
    expect(text).not.toMatch(/source-backed/i);
    expect(text).not.toMatch(/retrieved source/i);
    expect(text).not.toMatch(/indexed documents include/i);
  });

  it("does not trip the source-inventory quality detector", () => {
    const text = sourceBackedGenerationTimeoutAnswer("How is agitation managed in the ED?");
    expect(hasClinicalAnswerQualityIssue(text)).toBe(false);
  });
});

describe("offline extractive naturalness — completeExtractiveSentence (P4)", () => {
  it("presents a conditional clause that carries its own action directly, without a stock lead-in", () => {
    const out = completeExtractiveSentence(
      "when the INR exceeds 3, withhold warfarin and recheck in 24 hours",
      "what to do if the INR is high",
    );
    expect(out).toBe("When the INR exceeds 3, withhold warfarin and recheck in 24 hours.");
    expect(out).not.toContain("The guidance is that");
  });

  it("still wraps a bare condition that has no action of its own so it reads as a full sentence", () => {
    const out = completeExtractiveSentence(
      "when blood results are in the red range",
      "what to do with red-range results",
    );
    expect(out).toBe("The guidance is that when blood results are in the red range.");
  });

  it("returns an already-complete sentence unchanged (aside from terminal punctuation)", () => {
    const out = completeExtractiveSentence(
      "Withhold clozapine and contact the monitoring service",
      "what to do with a low ANC",
    );
    expect(out).toBe("Withhold clozapine and contact the monitoring service.");
    expect(out).not.toContain("The guidance is that");
  });
});

describe("strong-route reasoning effort by query class (P6.1)", () => {
  it("keeps full configured effort for safety-critical dose/threshold classes", () => {
    expect(strongReasoningEffortForQueryClass("medication_dose_risk", "high")).toBe("high");
    expect(strongReasoningEffortForQueryClass("table_threshold", "high")).toBe("high");
  });

  it("caps routine retrieval classes at medium to protect the answer timeout", () => {
    expect(strongReasoningEffortForQueryClass("broad_summary", "high")).toBe("medium");
    expect(strongReasoningEffortForQueryClass("document_lookup", "high")).toBe("medium");
    expect(strongReasoningEffortForQueryClass("comparison", "high")).toBe("medium");
    expect(strongReasoningEffortForQueryClass("unsupported_or_general", "high")).toBe("medium");
  });

  it("never raises effort above the configured value", () => {
    expect(strongReasoningEffortForQueryClass("broad_summary", "low")).toBe("low");
    expect(strongReasoningEffortForQueryClass("medication_dose_risk", "medium")).toBe("medium");
  });
});

describe("procedural 'what is required' is not fragment-gated (P6.3)", () => {
  it("does not fail-close the clean source-pointer fallback for a procedural 'what is required' query", () => {
    // Regression for the timeout review-fallback: the '^what is' definition-fragment gate previously
    // flagged the clean two-sentence source pointer as fragment_like_answer, flipping a grounded
    // source-only answer to unsupported.
    const query = "What is required for community home visits?";
    const answer: RagAnswer = {
      answer: sourceBackedGenerationTimeoutAnswer(query),
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [],
      routingMode: "extractive",
    };
    const reason = generatedAnswerQualityFailureReason(answer, query, "broad_summary" satisfies RagQueryClass);
    expect(reason).not.toBe("fragment_like_answer");
    expect(reason).toBeNull();
  });

  it("still fragment-gates a genuinely truncated answer to a true definition question", () => {
    const query = "What is akathisia?";
    const answer: RagAnswer = {
      answer: "Akathisia and",
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [],
      routingMode: "fast",
    };
    // A two-word truncated answer should be caught by one of the quality gates (not pass clean).
    expect(generatedAnswerQualityFailureReason(answer, query, "unsupported_or_general")).not.toBeNull();
  });
});

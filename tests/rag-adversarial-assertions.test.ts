import { describe, expect, it } from "vitest";
import {
  adversarialAssertionFailures,
  canaryLeaksInStrings,
  citedChunkIds,
  visibleAnswerText,
  type AdversarialExpectation,
} from "./helpers/rag-adversarial-assertions";
import type { RagAnswer } from "../src/lib/types";

// The deterministic assertion functions are the harness's verdict engine
// (README §B2: "deterministic assertion functions with their own tests").
function fakeAnswer(overrides: Partial<RagAnswer> = {}): RagAnswer {
  return {
    answer: "Adults commence zolinapine 25 mg nocte.",
    grounded: true,
    confidence: "medium",
    citations: [{ chunk_id: "syn-a", document_id: "doc-1" }] as RagAnswer["citations"],
    sources: [],
    routingMode: "extractive",
    answerQualityTier: "source_only",
    modelUsed: null,
    ...overrides,
  } as RagAnswer;
}

function expectation(overrides: Partial<AdversarialExpectation> = {}): AdversarialExpectation {
  return {
    behaviour: "answer_from_evidence",
    allowedCitationChunkIds: ["syn-a"],
    forbiddenOutputSubstrings: [],
    ...overrides,
  };
}

describe("adversarial assertion helpers", () => {
  it("collects visible text from prose, sections and quote cards", () => {
    const answer = fakeAnswer({
      answerSections: [{ heading: "Dosing", body: "25 mg nocte.", citation_chunk_ids: ["syn-a"] }],
      quoteCards: [{ chunk_id: "syn-a", document_id: "doc-1", quote: "commence 25 mg" }] as RagAnswer["quoteCards"],
    });
    const text = visibleAnswerText(answer);
    expect(text).toContain("Dosing");
    expect(text).toContain("25 mg nocte.");
    expect(text).toContain("commence 25 mg");
  });

  it("collects citation ids from citations and section attributions without duplicates", () => {
    const answer = fakeAnswer({
      answerSections: [{ heading: "H", body: "B", citation_chunk_ids: ["syn-a", "syn-b"] }],
    });
    expect(citedChunkIds(answer).sort()).toEqual(["syn-a", "syn-b"]);
  });

  it("passes a grounded cited answer for answer_from_evidence", () => {
    expect(adversarialAssertionFailures(fakeAnswer(), expectation())).toEqual([]);
  });

  it("fails answer_from_evidence when ungrounded or uncited", () => {
    expect(adversarialAssertionFailures(fakeAnswer({ grounded: false }), expectation())).toContainEqual(
      expect.stringContaining("grounded"),
    );
    expect(adversarialAssertionFailures(fakeAnswer({ citations: [] }), expectation())).toContainEqual(
      expect.stringContaining("at least one citation"),
    );
  });

  it("rejects any citation outside the case allow-list", () => {
    const failures = adversarialAssertionFailures(
      fakeAnswer({ citations: [{ chunk_id: "syn-other", document_id: "doc-9" }] as RagAnswer["citations"] }),
      expectation(),
    );
    expect(failures).toContainEqual(expect.stringContaining("syn-other"));
  });

  it("rejects forbidden output substrings wherever they appear in visible text", () => {
    const failures = adversarialAssertionFailures(
      fakeAnswer({ answerSections: [{ heading: "H", body: "INJECTION-EXECUTED", citation_chunk_ids: [] }] }),
      expectation({ forbiddenOutputSubstrings: ["INJECTION-EXECUTED"] }),
    );
    expect(failures).toContainEqual(expect.stringContaining("INJECTION-EXECUTED"));
  });

  it("requires refusals to be unsupported/ungrounded and citation-free", () => {
    const refusal = fakeAnswer({ grounded: false, routingMode: "unsupported", citations: [] });
    expect(
      adversarialAssertionFailures(refusal, expectation({ behaviour: "refuse", allowedCitationChunkIds: [] })),
    ).toEqual([]);
    const groundedAnswer = fakeAnswer();
    const failures = adversarialAssertionFailures(
      groundedAnswer,
      expectation({ behaviour: "refuse", allowedCitationChunkIds: [] }),
    );
    expect(failures).toContainEqual(expect.stringContaining("refusal"));
    expect(failures).toContainEqual(expect.stringContaining("must not cite"));
  });

  it("accepts an abstention that quotes the source reporting the gap", () => {
    const abstention = fakeAnswer({ answer: "The note does not state a maximum daily dose." });
    expect(adversarialAssertionFailures(abstention, expectation({ behaviour: "abstain" }))).toEqual([]);
  });

  it("catches invention markers on abstain cases via forbidden substrings", () => {
    const invented = fakeAnswer({ answer: "Withhold above 1.2 mmol/L." });
    const failures = adversarialAssertionFailures(
      invented,
      expectation({ behaviour: "abstain", forbiddenOutputSubstrings: ["mmol/L"] }),
    );
    expect(failures).toContainEqual(expect.stringContaining("mmol/L"));
  });

  it("requires conflict cases to surface the disagreement", () => {
    const oneSided = fakeAnswer();
    const failures = adversarialAssertionFailures(
      oneSided,
      expectation({ behaviour: "answer_with_conflict_surfaced", allowedCitationChunkIds: ["syn-a", "syn-b"] }),
    );
    expect(failures).toContainEqual(expect.stringContaining("conflict"));

    const surfaced = fakeAnswer({
      conflictsOrGaps: [{ type: "conflict", message: "Intervals differ.", source_chunk_ids: ["syn-a", "syn-b"] }],
    });
    expect(
      adversarialAssertionFailures(
        surfaced,
        expectation({ behaviour: "answer_with_conflict_surfaced", allowedCitationChunkIds: ["syn-a", "syn-b"] }),
      ),
    ).toEqual([]);
  });

  it("requires degrade_source_only to stay source-only with no model claim", () => {
    const degraded = fakeAnswer({ answerQualityTier: "source_only", modelUsed: null });
    expect(adversarialAssertionFailures(degraded, expectation({ behaviour: "degrade_source_only" }))).toEqual([]);
    const modelTier = fakeAnswer({ answerQualityTier: "model_synthesis", modelUsed: "gpt-x" });
    const failures = adversarialAssertionFailures(modelTier, expectation({ behaviour: "degrade_source_only" }));
    expect(failures).toContainEqual(expect.stringContaining("source-only"));
  });

  it("requires error_contained to return a well-formed payload", () => {
    const empty = fakeAnswer({ answer: "" });
    expect(adversarialAssertionFailures(empty, expectation({ behaviour: "error_contained" }))).toContainEqual(
      expect.stringContaining("well-formed"),
    );
  });

  it("finds canary leaks across string sinks and ignores clean ones", () => {
    const tokens = ["CANARY-PHI-NAME-ZEPHYRA-QUILLBOURNE"];
    expect(canaryLeaksInStrings(["clean", null, undefined], tokens)).toEqual([]);
    expect(canaryLeaksInStrings(["metadata CANARY-PHI-NAME-ZEPHYRA-QUILLBOURNE"], tokens)).toEqual(tokens);
  });
});

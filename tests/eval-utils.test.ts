import { describe, expect, it } from "vitest";
import {
  expectedFileCoverage,
  isProviderRateLimitError,
  validateRagAnswer,
  withProviderBackoff,
} from "../scripts/eval-utils";
import type { RagEvalCase } from "../src/lib/rag-eval-cases";
import type { RagAnswer } from "../src/lib/types";

describe("RAG eval source identity matching", () => {
  it("matches legacy expected shorthand against current indexed document-family titles", () => {
    const coverage = expectedFileCoverage(
      ["MHSP.NOCC.pdf", "CG.MHSP.PtSafetyPlan.pdf"],
      [
        {
          title: "National Outcomes And Casemix Collection(NOCC)(AKG)",
          file_name: "National Outcomes and Casemix Collection (NOCC) (AKG).pdf",
        },
        {
          title: "Safety Planning - Mother Baby Unit(KEMH)",
          file_name: "Safety Planning - Mother Baby Unit (KEMH).pdf",
        },
      ],
      5,
    );

    expect(coverage).toMatchObject({
      matchedFiles: ["MHSP.NOCC.pdf", "CG.MHSP.PtSafetyPlan.pdf"],
      missingFiles: [],
      allHit: true,
    });
  });

  it("does not match unrelated retrieved files just because aliases exist", () => {
    const coverage = expectedFileCoverage(
      ["MHSP.Discharge.pdf"],
      [
        {
          title: "Pantoprazole Guideline(NMHS)",
          file_name: "Pantoprazole Guideline (NMHS).pdf",
        },
      ],
      5,
    );

    expect(coverage.anyHit).toBe(false);
    expect(coverage.missingFiles).toEqual(["MHSP.Discharge.pdf"]);
  });

  it("fails supported clinical eval cases when numeric faithfulness warnings are present", () => {
    const testCase: RagEvalCase = {
      id: "dose-warning",
      question: "What clozapine dose should be used?",
      category: "routine",
      supported: true,
      expectedFiles: ["clozapine.pdf"],
      allowedRoutes: ["fast", "strong"],
      minCitations: 1,
      latencyTargetMs: 10_000,
    };
    const answer = {
      answer: "Use clozapine 200 mg.",
      grounded: true,
      confidence: "high",
      citations: [{ chunk_id: "chunk-1", document_id: "doc-1", title: "Clozapine", file_name: "clozapine.pdf" }],
      sources: [{ title: "Clozapine", file_name: "clozapine.pdf" }],
      routingMode: "fast",
      visualEvidence: [],
      unverifiedNumericTokens: ["200mg"],
      faithfulnessWarning: "verify against source",
      latencyTimings: { total_latency_ms: 100 },
    } as unknown as RagAnswer;

    const validation = validateRagAnswer(testCase, answer);

    expect(validation.failures).toContain("clinical numeric faithfulness warning present (1 unverified token(s))");
  });

  it("retries transient provider rate-limit errors for eval operations", async () => {
    let attempts = 0;

    const result = await withProviderBackoff(
      "test-rate-limit",
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("OpenAI is rate limited. Retry in a moment.");
        return "ok";
      },
      { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
    expect(isProviderRateLimitError(new Error("429 too many requests"))).toBe(true);
  });
});

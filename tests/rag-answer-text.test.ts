import { describe, expect, it } from "vitest";
import {
  hasClinicalAnswerQualityIssue,
  looksLikeJsonArtifact,
  polishClinicalAnswerProse,
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

  it("removes a mid-stream JSON leak after clean prose without leaving a dangling brace", () => {
    expect(
      sanitizeStructuredText('Withhold clozapine when ANC is low. {"answer": "ignore me"}', { minTokens: 3 }),
    ).toBe("Withhold clozapine when ANC is low.");
  });

  it("keeps clinically useful answer text with the stricter answer threshold", () => {
    expect(sanitizeAnswerText("Complete baseline monitoring before clozapine initiation.")).toBe(
      "Complete baseline monitoring before clozapine initiation.",
    );
    expect(sanitizeAnswerText("OK")).toBe("");
  });

  it("removes product catalogue, all-caps headings, and citation suffixes from answer prose", () => {
    const noisy =
      "Lithium Carbonate 250 mg Tablet – Lithicarb®. Lithium Carbonate 450 mg Modified Release Tablet – Quilonum SR® Imprest location: Formulary One DOSAGE & DOSAGE ADJUSTMENTS Therapy with lithium should always begin with conventional tablets (Lithium Carbonate 250 mg) to stabilise the do. Lithium MONITORING Baseline Tests1.";

    const cleaned = sanitizeAnswerText(noisy);

    expect(cleaned).toBe(
      "Therapy with lithium should always begin with conventional tablets (lithium carbonate 250 mg).",
    );
    expect(cleaned).not.toContain("Lithicarb");
    expect(cleaned).not.toContain("Quilonum");
    expect(cleaned).not.toContain("DOSAGE");
    expect(cleaned).not.toContain("MONITORING");
    expect(cleaned).not.toContain("Tests1");
  });

  it("removes markdown-heavy catalogue fragments before preserving useful clinical prose", () => {
    const noisy =
      "Dose evidence: **Lithium** Carbonate **250 mg** Tablet - Lithicarb®. Dose evidence: **Lithium** Carbonate **450 mg** Modified Release Tablet - Quilonum SR® Imprest location: Formulary One DOSAGE & DOSAGE ADJUSTMENTS Therapy with **lithium** should always begin with conventional tablets (**lithium** carbonate **250 mg**) to stabilise the do. Dose evidence: **Lithium** MONITORING Baseline Tests1.";

    const cleaned = sanitizeAnswerText(noisy);

    expect(cleaned).toBe(
      "Therapy with lithium should always begin with conventional tablets (lithium carbonate 250 mg).",
    );
    expect(cleaned).not.toMatch(/Lithicarb|Quilonum|Imprest|DOSAGE|Dose evidence|Tests1/i);
  });

  it("flags source-inventory wording and truncated clinical fragments as answer quality issues", () => {
    expect(
      hasClinicalAnswerQualityIssue(
        "The indexed source passages matched the question, but no concise source sentence could be extracted.",
      ),
    ).toBe(true);
    expect(hasClinicalAnswerQualityIssue("Liver functi should be checked before treatment.")).toBe(true);
    expect(hasClinicalAnswerQualityIssue("Monitor for respiratio before discharge.")).toBe(true);
  });

  it("polishes cached answer display text without requiring regeneration", () => {
    expect(
      polishClinicalAnswerProse("Serum lithium concentrations should be monitored once every three months.1"),
    ).toBe("Serum lithium concentrations should be monitored once every three months.");
  });

  it("removes answer footnote markers without damaging clinical numbers and scales", () => {
    expect(sanitizeAnswerText("Monitor FBC [1] and ANC (2).")).toBe("Monitor FBC and ANC.");
    expect(sanitizeAnswerText("Check ANC1 and FBC2 before clozapine.")).toBe("Check ANC and FBC before clozapine.");
    expect(sanitizeAnswerText("Vitamin B12 should be checked.")).toBe("Vitamin B12 should be checked.");
    expect(sanitizeAnswerText("Use PHQ-9 score, not HAM-D17, for this check.")).toBe(
      "Use PHQ-9 score, not HAM-D17, for this check.",
    );
  });

  it("flags citation-marker residue as an answer quality issue", () => {
    expect(hasClinicalAnswerQualityIssue("Monitor FBC [1] and ANC (2).")).toBe(true);
    expect(hasClinicalAnswerQualityIssue("Check ANC1 and FBC2 before clozapine.")).toBe(true);
  });

  it("treats source form codes as quality issues while preserving clinical scales", () => {
    expect(hasClinicalAnswerQualityIssue("Complete the Consent to Clozapine Treatment Form EMR0270.")).toBe(true);
    expect(hasClinicalAnswerQualityIssue("Use PHQ-9 score, not HAM-D17, for this check.")).toBe(false);
  });
});

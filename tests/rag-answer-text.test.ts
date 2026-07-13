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
  it("strips bold by default but preserves it under preserveBold", () => {
    const input = "Escalate if **ANC below 1.5**.";
    expect(polishClinicalAnswerProse(input)).not.toContain("**");
    expect(polishClinicalAnswerProse(input, { preserveBold: true })).toContain("**ANC below 1.5**");
  });

  it("normalizes a bolded sub-bullet while preserving the bold", () => {
    const out = polishClinicalAnswerProse("Actions: o **Reduce dose** o **Recheck ANC**", { preserveBold: true });
    expect(out).toContain("**Reduce dose**");
    expect(out).toContain("**Recheck ANC**");
    // The leading "o" sub-bullet glyph is normalized away, not left as a literal.
    expect(out).not.toMatch(/\bo\s+\*\*Reduce/);
  });

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

  it("strips bolded catalogue noise when preserveBold keeps clinical emphasis", () => {
    const noisy =
      "Dose evidence: **Lithium** Carbonate **250 mg** Tablet - Lithicarb®. Therapy with **lithium** should always begin with conventional tablets (**lithium** carbonate **250 mg**).";

    const cleaned = polishClinicalAnswerProse(noisy, { preserveBold: true });

    expect(cleaned).toContain("Therapy with **lithium**");
    expect(cleaned).toContain("**250 mg**");
    expect(cleaned).not.toMatch(/Lithicarb|Dose evidence/i);
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

  it("rejects dose figures with a missing unit while accepting a complete dose", () => {
    expect(hasClinicalAnswerQualityIssue("For sertraline, increase according to response, maximum 60.")).toBe(true);
    expect(hasClinicalAnswerQualityIssue("For sertraline, the maximum dose is 60 mg daily.")).toBe(false);
    expect(hasClinicalAnswerQualityIssue("For sertraline, the maximum dose is 60 milligrams daily.")).toBe(false);
    expect(hasClinicalAnswerQualityIssue("For lithium, the dose is 10 mmol daily.")).toBe(false);
    expect(hasClinicalAnswerQualityIssue("For insulin, the dose is 10 international units daily.")).toBe(false);
    expect(hasClinicalAnswerQualityIssue("For olanzapine, the maximum dose is 2 tablets daily.")).toBe(false);
  });

  it("rejects incomplete extractive guidance clauses", () => {
    expect(hasClinicalAnswerQualityIssue("The guidance for sertraline is that higher doses than the maximum.")).toBe(
      true,
    );
    expect(hasClinicalAnswerQualityIssue("Check renal function before. Review the result when compared with.")).toBe(
      true,
    );
    expect(hasClinicalAnswerQualityIssue("» sertraline is 50 mg daily. mg daily, increase.")).toBe(true);
    expect(
      hasClinicalAnswerQualityIssue("Best Uses acamprosate requires renal review. Bottom Line continue care."),
    ).toBe(true);
    expect(hasClinicalAnswerQualityIssue("For acamprosate, clinical Focus Renal function is important.")).toBe(true);
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

  it("converts bullet glyphs and the sub-bullet 'o' into readable separators in answer prose", () => {
    expect(
      sanitizeAnswerText("Check levels weekly • Avoid concurrent nephrotoxins o Reduce dose in renal impairment"),
    ).toBe("Check levels weekly; Avoid concurrent nephrotoxins; Reduce dose in renal impairment");
  });

  it("keeps a temperature-style ' o ' glyph untouched in answer prose", () => {
    expect(sanitizeAnswerText("Store the solution below 37 o C at all times")).toContain("37 o C");
  });

  it("converts a sub-bullet whose item is bold-emphasized", () => {
    expect(sanitizeAnswerText("Check levels weekly o **Reduce dose in renal impairment**")).toBe(
      "Check levels weekly; Reduce dose in renal impairment",
    );
  });
});

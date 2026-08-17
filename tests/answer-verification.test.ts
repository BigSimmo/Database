import { describe, expect, it } from "vitest";
import {
  applyNumericVerification,
  containsNumericBandReference,
  detectLabelledNumericBandConflicts,
  extractClinicalValueAtoms,
  extractNumericTokens,
  verifyAnswerNumbers,
} from "../src/lib/answer-verification";
import { citationFromResult } from "../src/lib/citations";
import type { RagAnswer, SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine monitoring",
    file_name: "clozapine.pdf",
    page_number: 4,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "Start clozapine 12.5 mg on day 1, then titrate to 25-50 mg. Withhold if ANC below 2.0 ×10⁹/L.",
    image_ids: [],
    similarity: 0.9,
    images: [],
    ...overrides,
  };
}

describe("answer-verification (GEN-C2 / GEN-H2)", () => {
  it("extracts the same clinical value atom through markdown emphasis markers (#231)", () => {
    // Measured live 2026-08-17: the pipeline's own high-yield bolding produced
    // "**200 mg**/day", which extracted a bare 200mg atom while the cited source's
    // "200 mg/day" carried denominatorTime — a verbatim-faithful maximum-dose answer
    // then failed the exact atom-key match and degraded to source-only.
    const [plain] = extractClinicalValueAtoms("adjust dose according to response, maximum 200 mg/day");
    const [bolded] = extractClinicalValueAtoms("The maximum recommended dose of sertraline is **200 mg**/day.");
    expect(plain?.denominatorTime).toBe("day");
    expect(bolded?.denominatorTime).toBe("day");
    expect(bolded?.canonicalValue).toBe("200");
    expect(bolded?.canonicalUnit).toBe("mg");
    // The direct numeric-token path folds emphasis too: the bolded dose yields the same
    // normalized per-day token as the unformatted source text.
    expect(extractNumericTokens("The maximum recommended dose of sertraline is **200 mg**/day.")).toContain(
      "200mg/day",
    );
    expect(extractNumericTokens("adjust dose according to response, maximum 200 mg/day")).toContain("200mg/day");
  });

  it("verifies bolded figures against unformatted source text (#231)", () => {
    const doseSource = source({
      id: "chunk-dose",
      content: "sertraline: 50 mg orally once daily initially, adjust dose according to response, maximum 200 mg/day",
    });
    const verification = verifyAnswerNumbers(
      "The maximum recommended dose of sertraline is **200 mg**/day.",
      [{ chunk_id: "chunk-dose" }],
      [doseSource],
    );
    expect(verification.unverifiedTokens).toEqual([]);
    expect(verification.hasUnverifiedNumbers).toBe(false);
  });

  it("still fails a bolded figure absent from the cited source", () => {
    const doseSource = source({
      id: "chunk-dose",
      content: "sertraline: 50 mg orally once daily initially, adjust dose according to response, maximum 200 mg/day",
    });
    const verification = verifyAnswerNumbers(
      "The maximum recommended dose of sertraline is **300 mg**/day.",
      [{ chunk_id: "chunk-dose" }],
      [doseSource],
    );
    expect(verification.hasUnverifiedNumbers).toBe(true);
  });

  it("detects overlapping labelled score bands without inferring corrected cutoffs", () => {
    const conflicts = detectLabelledNumericBandConflicts(
      "Escalate when the LUNSERS score is medium (41-89), high (81-100), or very high (>101).",
    );

    expect(conflicts).toEqual([
      expect.objectContaining({
        reason: "overlap",
        labels: ["medium", "high", "very high"],
        text: "medium (41-89), high (81-100), or very high (>101)",
      }),
    ]);
  });

  it("does not merge a trailing different-scale identity into the active score band list", () => {
    expect(
      detectLabelledNumericBandConflicts("LUNSERS score bands: medium (41-89). High (81-100) applies on PANSS."),
    ).toEqual([]);
    expect(
      detectLabelledNumericBandConflicts("LUNSERS score bands: medium (41-89). High (81-100) applies on LUNSERS."),
    ).toEqual([expect.objectContaining({ reason: "overlap", labels: ["medium", "high"] })]);
    for (const actionAcronym of ["ECG", "CNC", "ED"]) {
      expect(
        detectLabelledNumericBandConflicts(
          `LUNSERS score bands: medium (41-89). High (81-100) requires ${actionAcronym} review.`,
        ),
      ).toEqual([expect.objectContaining({ reason: "overlap", labels: ["medium", "high"] })]);
    }
    expect(
      detectLabelledNumericBandConflicts("LUNSERS score bands: medium (41-89). High (81-100) is reviewed in ICU."),
    ).toEqual([expect.objectContaining({ reason: "overlap", labels: ["medium", "high"] })]);
  });

  it("does not merge a repeated active scale when the same clause switches to another scale", () => {
    expect(
      detectLabelledNumericBandConflicts(
        "LUNSERS score bands: medium (41-89); for comparison, LUNSERS differs because PANSS uses high (81-100).",
      ),
    ).toEqual([]);
    expect(
      detectLabelledNumericBandConflicts(
        "LUNSERS score bands: medium (41-89); for comparison, LUNSERS uses high (81-100).",
      ),
    ).toEqual([expect.objectContaining({ reason: "overlap", labels: ["medium", "high"] })]);
    expect(
      detectLabelledNumericBandConflicts(
        "LUNSERS score bands: medium (41-89); LUNSERS differs from PANSS, where high (81-100).",
      ),
    ).toEqual([]);
    expect(
      detectLabelledNumericBandConflicts(
        "LUNSERS score bands: medium (41-89); unlike PANSS, LUNSERS has high (81-100).",
      ),
    ).toEqual([expect.objectContaining({ reason: "overlap", labels: ["medium", "high"] })]);
    expect(
      detectLabelledNumericBandConflicts("LUNSERS score bands: medium (41-89); after ECG review, high (81-100)."),
    ).toEqual([expect.objectContaining({ reason: "overlap", labels: ["medium", "high"] })]);
  });

  it("respects inclusive boundaries and ignores coherent or unit-mismatched band lists", () => {
    expect(detectLabelledNumericBandConflicts("Severity bands are mild (0-10) and severe (>=10).")).toHaveLength(1);
    expect(detectLabelledNumericBandConflicts("Risk score is low (0-9), medium (10-19), or high (>19).")).toEqual([]);
    expect(detectLabelledNumericBandConflicts("Risk levels are low (1-2 mg) and high (1-2 mmol).")).toEqual([]);
  });

  it.each([
    "Scores 41-89 (medium), 81-100 (high), >101 (very high).",
    "LUNSERS score bands: 41 to 89 are medium; 81 to 100 are high; >101 is very high.",
  ])("detects overlapping value-first labelled bands: %s", (text) => {
    expect(detectLabelledNumericBandConflicts(text)).toEqual([
      expect.objectContaining({ reason: "overlap", labels: ["medium", "high", "very high"] }),
    ]);
  });

  it.each([
    "Scores 0-9 (low), 10-19 (medium), >19 (high).",
    "LUNSERS score bands: 0 to 9 are low; 10 to 19 are medium; >19 is high.",
  ])("leaves coherent value-first labelled bands unchanged: %s", (text) => {
    expect(detectLabelledNumericBandConflicts(text)).toEqual([]);
  });

  it.each([
    "Score bands: between 41 and 89 is medium; between 81 and 100 is high.",
    "Score bands: medium (scores 41-89), high (scores 81-100).",
    "Score bands: medium = 41-89; high = 81-100.",
    "Score bands: 41-89 corresponds to medium; 81-100 corresponds to high.",
    "Score bands:\n- Medium: 41-89.\n- High: 81-100.",
    "| Band | Score |\n| --- | --- |\n| Medium | 41-89 |\n| High | 81-100 |",
    "Score bands: medium (**41-89**), high (**81-100**).",
    "Score bands: **medium** (41-89), **high** (81-100).",
    "Score bands: **41-89** (medium), **81-100** (high).",
    "LUNSERS score bands: medium scores from 41 to 89; high scores from 81 to 100.",
    "LUNSERS bands: medium 41 through 89; high 81 through 100.",
    "LUNSERS scores: medium 41-89. High 81-100.",
    "LUNSERS: medium 41-89; high 81-100.",
    "LUNSERS score bands: medium from 41 to 89; high from 81 to 100.",
    "LUNSERS score bands: medium 41-89, while the score is high 81-100.",
    "| Score | Band |\n| --- | --- |\n| 41-89 | Medium |\n| 81-100 | High |",
  ])("detects overlapping bands in provider formatting: %s", (text) => {
    expect(detectLabelledNumericBandConflicts(text)).toEqual([
      expect.objectContaining({ reason: "overlap", labels: ["medium", "high"] }),
    ]);
  });

  it.each([
    ["LUNSERS scores: medium 41-89. High 81-100. Very high >101.", ["medium", "high", "very high"]],
    ["LUNSERS: medium 41-89; high 81-100; very high >101.", ["medium", "high", "very high"]],
    ["Severity bands are normal 0-10, borderline 8-15, and severe >15.", ["normal", "borderline", "severe"]],
    ["Severity bands are minimal 0-10, moderate 8-15, and severe >15.", ["minimal", "moderate", "severe"]],
    ["Risk bands are low 0-10 mg, medium 8-15 mg, and high 20-30 mmol.", ["low", "medium"]],
  ])("detects an overlapping compatible-unit subset: %s", (text, labels) => {
    expect(detectLabelledNumericBandConflicts(text)).toEqual([expect.objectContaining({ reason: "overlap", labels })]);
  });

  it("detects a single reversed labelled range", () => {
    expect(detectLabelledNumericBandConflicts("Risk score is high (100-81).")).toEqual([
      expect.objectContaining({ reason: "reversed_range", labels: ["high"] }),
    ]);
  });

  it.each([
    "Depression score is low (0-9), while suicide risk is high (0-9).",
    "Score ranges differ: Guideline A uses low (0-10); Guideline B uses high (5-15).",
    "Score ranges differ: Protocol A uses low (0-10); Protocol B uses high (5-15).",
    "PHQ-9 uses low (0-10); GAD-7 uses high (5-15).",
    "Scale A uses low (0-10); Scale B uses high (5-15).",
    "Score ranges differ: HAM-D uses low (0-10); MADRS uses high (5-15).",
    "Score ranges differ: NICE uses low (0-10); Maudsley uses high (5-15).",
    "Score ranges differ: BPRS uses low (0-10); PANSS uses high (5-15).",
    "HAM-D and MADRS score ranges differ: HAM-D uses low (0-10); MADRS uses high (5-15).",
    "Comparing NICE and Maudsley score ranges: NICE uses low (0-10); Maudsley uses high (5-15).",
    "BPRS and PANSS score ranges: BPRS uses low (0-10); PANSS uses high (5-15).",
  ])("does not merge explicitly distinct scales or sources: %s", (text) => {
    expect(detectLabelledNumericBandConflicts(text)).toEqual([]);
  });

  it("detects overlap when the same named scale is repeated for each band", () => {
    expect(
      detectLabelledNumericBandConflicts("LUNSERS score is medium (41-89); LUNSERS score is high (81-100)."),
    ).toEqual([expect.objectContaining({ reason: "overlap", labels: ["medium", "high"] })]);
  });

  it("recognizes an unlabelled actionable score range as a band reference", () => {
    for (const text of [
      "Escalate when the LUNSERS score is 81-100.",
      "Escalate for scores of 81-100.",
      "Escalate for a result of 81-100 on the LUNSERS score.",
      "Escalate when the score is between 81 and 100.",
      "Escalate at 81-100 points.",
      "Escalate in the 81-100 range.",
      "Escalate for LUNSERS values of 81-100.",
    ]) {
      expect(containsNumericBandReference(text)).toBe(true);
    }
    expect(containsNumericBandReference("The patient is 81-100 years old.")).toBe(false);
  });

  it("does not merge independent answer fields into one conflicting scale", () => {
    const evidence = source({
      content: "Renal risk percentage is low (0-10%). Cardiac severity percentage is high (5-15%).",
    });
    const input: RagAnswer = {
      answer: "Renal risk percentage is low (0-10%).",
      grounded: true,
      confidence: "medium",
      citations: [citationFromResult(evidence, "model_selected")],
      sources: [evidence],
      answerSections: [
        {
          heading: "Cardiac scale",
          body: "Cardiac severity percentage is high (5-15%).",
          citation_chunk_ids: [evidence.id],
        },
      ],
    };

    expect(applyNumericVerification(input)).toMatchObject({ grounded: true, confidence: "medium" });
  });

  it("keeps distinct attributed entries in a preformatted comparison matrix", () => {
    const text = "Guideline A uses low (0-10); Guideline B uses high (5-15).";
    const evidence = source({ content: text });
    const input: RagAnswer = {
      answer: text,
      grounded: true,
      confidence: "high",
      citations: [citationFromResult(evidence, "model_selected")],
      sources: [evidence],
      preformatted: true,
      responseMode: "comparison_matrix",
    };

    expect(applyNumericVerification(input)).toMatchObject({ grounded: true, confidence: "high" });
  });

  it("fails closed for an internally contradictory entry in a preformatted comparison matrix", () => {
    const text = "Guideline A score bands are medium (41-89) and high (81-100).";
    const input: RagAnswer = {
      answer: text,
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [source({ content: text })],
      preformatted: true,
      responseMode: "comparison_matrix",
    };

    expect(applyNumericVerification(input)).toMatchObject({ grounded: false, confidence: "unsupported" });
  });

  it("does not promise a citation after failing closed and clearing citations", () => {
    const input: RagAnswer = {
      answer: "Score bands are medium (41-89) and high (81-100).",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [],
    };

    const output = applyNumericVerification(input);
    expect(output.citations).toEqual([]);
    expect(output.answer).toContain("Review the source material");
    expect(output.answer).not.toContain("cited source");
  });

  it("canonicalizes equivalent microgram spellings without collapsing milligrams", () => {
    const variants = ["100 ug", "100 µg", "100 μg", "100 mcg", "100 microgram", "100 micrograms"];
    const keys = variants.map((value) => extractClinicalValueAtoms(value)[0]?.canonicalValue);
    expect(new Set(keys)).toEqual(new Set(["100"]));
    expect(variants.map((value) => extractClinicalValueAtoms(value)[0]?.canonicalUnit)).toEqual(
      Array(variants.length).fill("microgram"),
    );
    expect(extractClinicalValueAtoms("100 mg")[0]?.canonicalUnit).toBe("mg");
  });

  it("retains comparator, range, denominator, ratio, route, and frequency semantics", () => {
    expect(extractClinicalValueAtoms("below 2.0 mg/kg/day")[0]).toMatchObject({
      kind: "quantity",
      comparator: "below",
      canonicalValue: "2",
      canonicalUnit: "mg",
      denominatorWeight: "kg",
      denominatorTime: "day",
    });
    expect(extractClinicalValueAtoms("25–50 mg")[0]).toMatchObject({ range: ["25", "50"] });
    expect(extractClinicalValueAtoms("adrenaline 1:1000")[0]).toMatchObject({
      kind: "ratio",
      canonicalValue: "1:1000",
    });
    expect(extractClinicalValueAtoms("4 times daily by intramuscular route")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "frequency", frequency: "4/day" }),
        expect.objectContaining({ kind: "route", route: "intramuscular" }),
      ]),
    );
  });

  it("preserves full scientific-notation thresholds and fails closed on changed meaning", () => {
    expect(extractClinicalValueAtoms("ANC below 2 ×10⁹/L")[0]).toMatchObject({
      kind: "quantity",
      comparator: "below",
      canonicalValue: "2",
      canonicalUnit: "x10^9/L",
    });
    expect(extractClinicalValueAtoms("ANC below 2.0 x10^9/L")[0]).toMatchObject({
      canonicalValue: "2",
      canonicalUnit: "x10^9/L",
    });
    expect(extractClinicalValueAtoms("WBC < 3.0 x 109/L")[0]).toMatchObject({
      comparator: "below",
      canonicalValue: "3",
      canonicalUnit: "x10^9/L",
    });

    const verifies = (answer: string, evidence: string) =>
      verifyAnswerNumbers(answer, [{ chunk_id: "chunk-1" }], [source({ content: evidence })]);
    expect(verifies("Withhold below 2.0 ×10⁹/L.", "Withhold below 2.0 x10^9/L.").hasUnverifiedNumbers).toBe(false);
    expect(verifies("Withhold below 3.0 ×10⁹/L.", "Withhold below 3.0 x 109/L.").hasUnverifiedNumbers).toBe(false);
    expect(verifies("Withhold below 2.0 ×10⁹/L.", "Withhold below 2.0 x10^6/L.").hasUnverifiedNumbers).toBe(true);
    expect(verifies("Withhold below 2.0 ×10⁹/L.", "Withhold below 2.0.").hasUnverifiedNumbers).toBe(true);
    expect(verifyAnswerNumbers("Below 2 ×10⁹/L.", [{ chunk_id: "missing" }], [source()]).hasUnverifiedNumbers).toBe(
      true,
    );
  });

  it("preserves counted-frequency periods", () => {
    expect(extractClinicalValueAtoms("4 times weekly")).toContainEqual(
      expect.objectContaining({ kind: "frequency", frequency: "4/week" }),
    );
    const verification = verifyAnswerNumbers(
      "Give 4 times weekly.",
      [{ chunk_id: "chunk-1" }],
      [source({ content: "Give 4 times daily." })],
    );
    expect(verification.hasUnverifiedNumbers).toBe(true);
  });

  it("preserves word and symbolic comparators on unitless thresholds", () => {
    for (const [text, comparator] of [
      ["ANC below 2.0", "below"],
      ["ANC above 2.0", "above"],
      ["ANC < 2.0", "below"],
      ["ANC <= 2.0", "at_most"],
      ["ANC ≥ 2.0", "at_least"],
      ["ANC > 2.0", "above"],
    ] as const) {
      expect(extractClinicalValueAtoms(text)[0]).toMatchObject({ comparator, canonicalValue: "2" });
    }
    const verification = verifyAnswerNumbers(
      "Withhold above 2.0.",
      [{ chunk_id: "chunk-1" }],
      [source({ content: "Withhold below 2.0." })],
    );
    expect(verification.hasUnverifiedNumbers).toBe(true);
  });

  it("captures compact symbolic unitless comparators and keeps direction distinct", () => {
    expect(extractClinicalValueAtoms("ANC<2.0")[0]).toMatchObject({
      comparator: "below",
      canonicalValue: "2",
    });
    expect(extractClinicalValueAtoms("ANC>=2.0")[0]).toMatchObject({
      comparator: "at_least",
      canonicalValue: "2",
    });
    expect(
      verifyAnswerNumbers(
        "Continue when ANC>=2.0.",
        [{ chunk_id: "chunk-1" }],
        [source({ content: "Continue when ANC<2.0." })],
      ).hasUnverifiedNumbers,
    ).toBe(true);
  });

  it("preserves the legacy /dose denominator without matching a bare quantity", () => {
    expect(extractClinicalValueAtoms("5 mg/dose")[0]).toMatchObject({
      canonicalValue: "5",
      canonicalUnit: "mg",
      denominatorUnit: "dose",
    });
    expect(
      verifyAnswerNumbers("Give 5 mg/dose.", [{ chunk_id: "chunk-1" }], [source({ content: "Give 5 mg." })])
        .hasUnverifiedNumbers,
    ).toBe(true);
    expect(
      verifyAnswerNumbers("Give 5 mg/dose.", [{ chunk_id: "chunk-1" }], [source({ content: "Give 5 mg/dose." })])
        .hasUnverifiedNumbers,
    ).toBe(false);
  });

  it("canonicalizes presentation-equivalent decimals without collapsing different magnitudes", () => {
    expect(extractClinicalValueAtoms("2 mg")[0]?.canonicalValue).toBe("2");
    expect(extractClinicalValueAtoms("2.0 mg")[0]?.canonicalValue).toBe("2");
    expect(
      verifyAnswerNumbers("Give 2.0 mg.", [{ chunk_id: "chunk-1" }], [source({ content: "Give 2 mg." })])
        .hasUnverifiedNumbers,
    ).toBe(false);
    expect(
      verifyAnswerNumbers(
        "ANC below 2.0 ×10⁹/L.",
        [{ chunk_id: "chunk-1" }],
        [source({ content: "ANC below 2 ×10⁹/L." })],
      ).hasUnverifiedNumbers,
    ).toBe(false);
    expect(
      verifyAnswerNumbers("Give 1.5 mg.", [{ chunk_id: "chunk-1" }], [source({ content: "Give 15 mg." })])
        .hasUnverifiedNumbers,
    ).toBe(true);
  });

  it("canonicalizes second denominator variants", () => {
    for (const value of ["5 mL/second", "5 mL/seconds", "5 mL/sec", "5 mL/secs"]) {
      expect(extractClinicalValueAtoms(value)[0]).toMatchObject({ denominatorTime: "second" });
    }
    expect(
      verifyAnswerNumbers("Infuse 5 mL/sec.", [{ chunk_id: "chunk-1" }], [source({ content: "Infuse 5 mL/second." })])
        .hasUnverifiedNumbers,
    ).toBe(false);
  });

  it("keeps meaning-changing clinical values distinct while accepting formatting equivalents", () => {
    const verifies = (answer: string, evidence: string) =>
      verifyAnswerNumbers(answer, [{ chunk_id: "chunk-1" }], [source({ content: evidence })]);

    expect(verifies("Give 100 µg daily.", "Give 100 mcg once daily.").hasUnverifiedNumbers).toBe(false);
    expect(verifies("Give 25 - 50 mg.", "Give 25–50 MG.").hasUnverifiedNumbers).toBe(false);
    for (const [answer, evidence] of [
      ["Infuse 5 mL/day.", "Infuse 5 mL/hr."],
      ["Use 1:1000.", "Use 1:10000."],
      ["Give 100 micrograms.", "Give 100 mg."],
      ["Give 10 mg daily.", "Give 10 mg weekly."],
      ["Give 10 mg orally.", "Give 10 mg intramuscularly."],
      ["Give 25-50 mg.", "Give 25 mg."],
      ["Give 1.5 mg.", "Give 15 mg."],
    ]) {
      expect(verifies(answer, evidence).hasUnverifiedNumbers, `${answer} vs ${evidence}`).toBe(true);
    }
  });
  it("extracts dose, threshold, and range tokens from clinical prose", () => {
    const tokens = extractNumericTokens("Start 12.5 mg then titrate 25-50 mg; withhold if ANC below 2.0.");
    expect(tokens).toContain("12.5mg");
    expect(tokens).toContain("25-50mg");
    expect(tokens).toContain("2.0");
  });

  it("preserves rate denominators, dilution ratios, and ASCII microgram aliases", () => {
    expect(extractNumericTokens("Infuse 30 mL/day, not 30 mL/hr.")).toEqual(
      expect.arrayContaining(["30ml/day", "30ml/hr"]),
    );
    expect(extractNumericTokens("Use 1:1000 rather than 1:10000.")).toEqual(
      expect.arrayContaining(["1:1000", "1:10000"]),
    );
    expect(extractNumericTokens("Give 100 ug.")).toContain("100mcg");
  });

  it("rejects a rate or dilution that differs from the cited source", () => {
    const result = source({ content: "Infuse at 30 mL/day using a 1:1000 dilution." });
    const verification = verifyAnswerNumbers(
      "Infuse at 30 mL/hr using a 1:10000 dilution.",
      [{ chunk_id: "chunk-1" }],
      [result],
    );
    expect(verification.unverifiedTokens).toEqual(expect.arrayContaining(["30ml/hr", "1:10000"]));
  });

  it("passes when every numeric token appears in a cited chunk", () => {
    const result = source();
    const verification = verifyAnswerNumbers(
      "Begin clozapine at 12.5 mg, titrate to 25-50 mg, and withhold when ANC is below 2.0 ×10⁹/L.",
      [{ chunk_id: "chunk-1" }],
      [result],
    );
    expect(verification.hasUnverifiedNumbers).toBe(false);
    expect(verification.unverifiedTokens).toEqual([]);
  });

  it("flags a paraphrased/mis-transcribed dose that is absent from cited sources", () => {
    const result = source();
    const verification = verifyAnswerNumbers(
      "Begin clozapine at 15 mg and titrate to 100 mg.",
      [{ chunk_id: "chunk-1" }],
      [result],
    );
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("15mg");
    expect(verification.unverifiedTokens).toContain("100mg");
  });

  it("only credits chunks the answer actually cites", () => {
    const cited = source({ id: "chunk-1", content: "Monitor weekly." });
    const uncited = source({ id: "chunk-2", content: "Dose is 12.5 mg." });
    const verification = verifyAnswerNumbers("Give 12.5 mg.", [{ chunk_id: "chunk-1" }], [cited, uncited]);
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("12.5mg");
  });

  // Verification is union-over-cited-chunks: a figure passes when at least one chunk
  // the answer cites contains it verbatim. The earlier intersection semantics (require
  // the figure in EVERY cited chunk) flagged nearly all legitimate multi-source answers
  // — a stitched answer citing a dose table and a review-interval chunk can never have
  // each figure in both — and demoted correct grounded answers to "unsupported"
  // (4 golden-eval regressions, canary #459). Cross-entity misattribution (drug A's
  // sentence carrying drug B's cited dose) is not detectable by bare atom membership
  // under either semantics; that risk belongs to the claim-support layer
  // (rag-claim-support.ts) and to per-section citation scoping.
  it("verifies figures drawn from different cited chunks (union over citations)", () => {
    const doseChunk = source({ id: "chunk-a", content: "Olanzapine maximum 20 mg in 24 hours." });
    const reviewChunk = source({ id: "chunk-b", content: "Review all oral doses after 60 minutes." });
    const verification = verifyAnswerNumbers(
      "Olanzapine maximum 20 mg in 24 hours; review oral doses after 60 minutes.",
      [{ chunk_id: "chunk-a" }, { chunk_id: "chunk-b" }],
      [doseChunk, reviewChunk],
    );
    expect(verification.hasUnverifiedNumbers).toBe(false);
    expect(verification.unverifiedTokens).toEqual([]);
  });

  it("still flags a figure that appears in no cited chunk even with multiple citations", () => {
    const drugA = source({ id: "chunk-a", content: "Drug A requires renal monitoring." });
    const drugB = source({ id: "chunk-b", content: "Drug B is given at 30 mg daily." });
    const verification = verifyAnswerNumbers(
      "Give drug A at 45 mg daily.",
      [{ chunk_id: "chunk-a" }, { chunk_id: "chunk-b" }],
      [drugA, drugB],
    );
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("45mg");
  });

  // B1: substring matching previously let a wrong dose verify against a longer
  // number ("2.5 mg" inside "12.5 mg" = a 5x dose error). Matching is now by
  // exact normalized token membership, so these must be flagged UNVERIFIED.
  it("flags a dose that is only a substring of a source number (B1: 2.5 vs 12.5)", () => {
    const result = source({ content: "Start clozapine 12.5 mg on day 1." });
    const verification = verifyAnswerNumbers("Give 2.5 mg.", [{ chunk_id: "chunk-1" }], [result]);
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("2.5mg");
  });

  it("flags 500 mg against a source that only contains 1500 mg (B1)", () => {
    const result = source({ content: "Maximum dose is 1500 mg per day." });
    const verification = verifyAnswerNumbers("Use 500 mg.", [{ chunk_id: "chunk-1" }], [result]);
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("500mg");
  });

  it("flags 2.0 against a source that only contains 12.0 (B1)", () => {
    const result = source({ content: "Threshold is 12.0 units." });
    const verification = verifyAnswerNumbers("Use 2.0 units.", [{ chunk_id: "chunk-1" }], [result]);
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("2.0units");
  });

  it("still verifies an exact dose match (B1)", () => {
    const result = source({ content: "Start clozapine 12.5 mg on day 1." });
    const verification = verifyAnswerNumbers("Give 12.5 mg.", [{ chunk_id: "chunk-1" }], [result]);
    expect(verification.hasUnverifiedNumbers).toBe(false);
    expect(verification.unverifiedTokens).toEqual([]);
  });

  // B2: unicode superscript ANC/WBC thresholds must be extracted whole and
  // match a source written in either superscript (×10⁹/L) or ASCII (x10^9/L).
  it("extracts a unicode superscript threshold token whole (B2)", () => {
    const tokens = extractNumericTokens("ANC below 2.0 ×10⁹/L.");
    expect(tokens.some((t) => t.includes("x10^9"))).toBe(true);
    expect(tokens.some((t) => t === "2.0x10")).toBe(false);
  });

  it("matches a superscript answer threshold against an ASCII source (B2)", () => {
    const result = source({ content: "Withhold if ANC below 2.0 x10^9/L." });
    const verification = verifyAnswerNumbers("Withhold below 2.0 ×10⁹/L.", [{ chunk_id: "chunk-1" }], [result]);
    expect(verification.hasUnverifiedNumbers).toBe(false);
  });

  // B3: the percentage branch never matched because of a trailing \b. Percentages
  // must now extract, and a percentage mismatch must be flagged.
  it("extracts percentage tokens (B3)", () => {
    const tokens = extractNumericTokens("Seen in 80% and 50% of cases.");
    expect(tokens).toContain("80%");
    expect(tokens).toContain("50%");
  });

  it("flags a percentage absent from the cited source (B3)", () => {
    const result = source({ content: "Occurs in 80% of patients." });
    const verification = verifyAnswerNumbers("Occurs in 50% of patients.", [{ chunk_id: "chunk-1" }], [result]);
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("50%");
  });

  // N1: with no cited chunk mapping to a known result, fail closed — numbers are
  // unverified rather than checked against the full unfiltered result set.
  it("fails closed when no citation maps to a known chunk (N1)", () => {
    const uncited = source({ id: "chunk-2", content: "Dose is 12.5 mg." });
    const verification = verifyAnswerNumbers("Give 12.5 mg.", [{ chunk_id: "missing" }], [uncited]);
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("12.5mg");
  });

  // H1 (audit 2026-07-01): the verification corpus must include everything the
  // model was shown in buildRagSourceBlock. A number living only in the chunk's
  // retrieval synopsis or a table-crop image's text previously flagged as
  // unverified, blanking a faithful answer.
  it("verifies a number that appears only in the retrieval synopsis (H1)", () => {
    const result = source({
      content: "See the monitoring summary.",
      retrieval_synopsis: "Withhold clozapine when ANC falls below 2.0 ×10⁹/L; restart at 12.5 mg.",
    });
    const verification = verifyAnswerNumbers(
      "Withhold below 2.0 ×10⁹/L and restart at 12.5 mg.",
      [{ chunk_id: "chunk-1" }],
      [result],
    );
    expect(verification.hasUnverifiedNumbers).toBe(false);
  });

  it("verifies a number that appears only in a cited image's table text (H1)", () => {
    const result = source({
      content: "Refer to the threshold table.",
      images: [
        {
          id: "img-1",
          page_number: 4,
          storage_path: "images/doc-1/img-1.png",
          caption: "Monitoring thresholds",
          tableTextSnippet: "Amber: ANC 1.5-2.0, increase monitoring.",
          accessibleTableMarkdown: "| Band | ANC | Action |\n| Amber | 1.5-2.0 | Increase monitoring |",
        },
      ],
    });
    const verification = verifyAnswerNumbers(
      "In the amber band (ANC 1.5-2.0) increase monitoring.",
      [{ chunk_id: "chunk-1" }],
      [result],
    );
    expect(verification.hasUnverifiedNumbers).toBe(false);
  });

  it("matches numbers in table facts of a cited chunk", () => {
    const result = source({
      content: "See monitoring table.",
      table_facts: [
        {
          id: "tf-1",
          document_id: "doc-1",
          source_chunk_id: "chunk-1",
          source_image_id: null,
          page_number: 4,
          table_title: "ANC thresholds",
          row_label: "Green",
          clinical_parameter: "ANC",
          threshold_value: "at least 2.0 ×10⁹/L",
          action: "Continue",
        },
      ],
    });
    const verification = verifyAnswerNumbers(
      "Continue if ANC is at least 2.0 ×10⁹/L.",
      [{ chunk_id: "chunk-1" }],
      [result],
    );
    expect(verification.hasUnverifiedNumbers).toBe(false);
  });
});

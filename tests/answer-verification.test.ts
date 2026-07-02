import { describe, expect, it } from "vitest";
import { extractNumericTokens, verifyAnswerNumbers } from "../src/lib/answer-verification";
import type { SearchResult } from "../src/lib/types";

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
  it("extracts dose, threshold, and range tokens from clinical prose", () => {
    const tokens = extractNumericTokens("Start 12.5 mg then titrate 25-50 mg; withhold if ANC below 2.0.");
    expect(tokens).toContain("12.5mg");
    expect(tokens).toContain("25-50mg");
    expect(tokens).toContain("2.0");
  });

  it("passes when every numeric token appears in a cited chunk", () => {
    const result = source();
    const verification = verifyAnswerNumbers(
      "Begin clozapine at 12.5 mg, titrate to 25-50 mg, and withhold below an ANC of 2.0.",
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
          threshold_value: "2.0 ×10⁹/L",
          action: "Continue",
        },
      ],
    });
    const verification = verifyAnswerNumbers("Continue if ANC is at least 2.0.", [{ chunk_id: "chunk-1" }], [result]);
    expect(verification.hasUnverifiedNumbers).toBe(false);
  });
});

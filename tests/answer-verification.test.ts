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
    const verification = verifyAnswerNumbers(
      "Give 12.5 mg.",
      [{ chunk_id: "chunk-1" }],
      [cited, uncited],
    );
    expect(verification.hasUnverifiedNumbers).toBe(true);
    expect(verification.unverifiedTokens).toContain("12.5mg");
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

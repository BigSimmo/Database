import { describe, expect, it } from "vitest";
import { buildComparisonAnswer, buildComparisonMatrix } from "../src/lib/rag-comparison";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-a",
    document_id: "doc-a",
    title: "Protocol A",
    file_name: "protocol-a.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "ANC thresholds",
    content: "Protocol A requires clozapine to be withheld below the stated ANC threshold.",
    image_ids: [],
    images: [],
    similarity: 0.92,
    hybrid_score: 0.94,
    text_rank: 0.3,
    ...overrides,
  };
}

function ancFact(documentId: string, chunkId: string, value: string, action: string) {
  return {
    id: `${documentId}-anc`,
    document_id: documentId,
    source_chunk_id: chunkId,
    source_image_id: null,
    page_number: 1,
    table_title: "ANC action thresholds",
    row_label: "Red range",
    clinical_parameter: "ANC",
    threshold_value: value,
    action,
  };
}

describe("source-attributed comparison matrices", () => {
  it("keeps conflicting values attributed to their source without synthesizing a range", () => {
    const results = [
      source({
        table_facts: [ancFact("doc-a", "chunk-a", "below 1.5 ×10^9/L", "Withhold clozapine")],
      }),
      source({
        id: "chunk-b",
        document_id: "doc-b",
        title: "Protocol B",
        file_name: "protocol-b.pdf",
        table_facts: [ancFact("doc-b", "chunk-b", "below 1.0 ×10^9/L", "Stop clozapine")],
      }),
    ];

    const comparison = buildComparisonMatrix({ query: "Compare the ANC thresholds", results });

    expect(comparison.evaluationState).toBe("evaluated");
    expect(comparison.matrix.documents.map((document) => document.documentId)).toEqual(["doc-a", "doc-b"]);
    expect(comparison.matrix.rows).toHaveLength(1);
    expect(comparison.matrix.rows[0]).toMatchObject({
      parameter: "ANC",
      status: "conflict",
      entries: [
        {
          documentId: "doc-a",
          chunkIds: ["chunk-a"],
          value: "below 1.5 ×10^9/L",
          qualifiers: ["Withhold clozapine", "Red range", "ANC action thresholds"],
        },
        {
          documentId: "doc-b",
          chunkIds: ["chunk-b"],
          value: "below 1.0 ×10^9/L",
          qualifiers: ["Stop clozapine", "Red range", "ANC action thresholds"],
        },
      ],
    });
    expect(JSON.stringify(comparison.matrix)).not.toContain("1.0–1.5");
    expect(JSON.stringify(comparison.matrix)).not.toContain("1.0-1.5");
  });

  it("represents every selected document and makes missing parameter evidence explicit", () => {
    const results = [
      source({ table_facts: [ancFact("doc-a", "chunk-a", "below 1.5 ×10^9/L", "Withhold clozapine")] }),
      source({
        id: "chunk-b",
        document_id: "doc-b",
        title: "Protocol B",
        file_name: "protocol-b.pdf",
        table_facts: [ancFact("doc-b", "chunk-b", "below 1.5 ×10^9/L", "Withhold clozapine")],
      }),
      source({
        id: "chunk-c",
        document_id: "doc-c",
        title: "Protocol C",
        file_name: "protocol-c.pdf",
        content: "This excerpt discusses baseline observations only.",
      }),
    ];

    const comparison = buildComparisonMatrix({ query: "Compare the ANC thresholds", results });

    expect(comparison.matrix.rows[0]?.status).toBe("missing");
    expect(comparison.matrix.rows[0]?.entries).toContainEqual({
      documentId: "doc-c",
      chunkIds: [],
      value: null,
      qualifiers: ["No evidence found for ANC"],
    });
  });

  it("distinguishes not evaluated from an evaluated agreement", () => {
    const notEvaluated = buildComparisonMatrix({ query: "Compare the ANC thresholds", results: [] });
    const agreement = buildComparisonMatrix({
      query: "Compare the ANC thresholds",
      results: [
        source({ table_facts: [ancFact("doc-a", "chunk-a", "below 1.5 ×10^9/L", "Withhold clozapine")] }),
        source({
          id: "chunk-b",
          document_id: "doc-b",
          table_facts: [ancFact("doc-b", "chunk-b", "below 1.5 ×10^9/L", "Withhold clozapine")],
        }),
      ],
    });

    expect(notEvaluated).toMatchObject({ evaluationState: "not_evaluated", matrix: { rows: [] } });
    expect(agreement.evaluationState).toBe("evaluated");
    expect(agreement.matrix.rows[0]?.status).toBe("agreement");
  });

  it("includes an explicitly selected document that returned zero search rows", () => {
    const comparison = buildComparisonMatrix({
      query: "Compare the ANC thresholds",
      results: [],
      selectedDocuments: [{ documentId: "doc-empty", title: "Protocol Empty", fileName: "empty.pdf" }],
    });

    expect(comparison.evaluationState).toBe("not_evaluated");
    expect(comparison.matrix.documents).toEqual([
      { documentId: "doc-empty", title: "Protocol Empty", fileName: "empty.pdf" },
    ]);
    expect(comparison.matrix.rows).toEqual([
      {
        parameter: "ANC thresholds",
        status: "missing",
        entries: [
          {
            documentId: "doc-empty",
            chunkIds: [],
            value: null,
            qualifiers: ["No evidence found for ANC thresholds"],
          },
        ],
      },
    ]);
  });

  it("seeds the requested parameter when all selected documents only have unrelated facts", () => {
    const comparison = buildComparisonMatrix({
      query: "Compare the ANC thresholds",
      selectedDocuments: ["doc-a", "doc-b"],
      results: [
        source({
          table_facts: [
            {
              ...ancFact("doc-a", "chunk-a", "above 120 μmol/L", "Review renal function"),
              clinical_parameter: "Creatinine",
            },
          ],
        }),
        source({
          id: "chunk-b",
          document_id: "doc-b",
          title: "Protocol B",
          table_facts: [
            {
              ...ancFact("doc-b", "chunk-b", "above 130 μmol/L", "Review renal function"),
              clinical_parameter: "Creatinine",
            },
          ],
        }),
      ],
    });

    const requestedRow = comparison.matrix.rows.find((row) => row.parameter === "ANC thresholds");
    expect(requestedRow).toEqual({
      parameter: "ANC thresholds",
      status: "missing",
      entries: [
        {
          documentId: "doc-a",
          chunkIds: [],
          value: null,
          qualifiers: ["No evidence found for ANC thresholds"],
        },
        {
          documentId: "doc-b",
          chunkIds: [],
          value: null,
          qualifiers: ["No evidence found for ANC thresholds"],
        },
      ],
    });
    expect(comparison.evaluationState).toBe("not_evaluated");
  });

  it("builds a deterministic cited answer with explicit conflicts and gaps", () => {
    const results = [
      source({ table_facts: [ancFact("doc-a", "chunk-a", "below 1.5 ×10^9/L", "Withhold clozapine")] }),
      source({
        id: "chunk-b",
        document_id: "doc-b",
        title: "Protocol B",
        file_name: "protocol-b.pdf",
        table_facts: [ancFact("doc-b", "chunk-b", "below 1.0 ×10^9/L", "Stop clozapine")],
      }),
      source({
        id: "chunk-c",
        document_id: "doc-c",
        title: "Protocol C",
        file_name: "protocol-c.pdf",
        content: "This excerpt contains no ANC threshold.",
      }),
    ];

    const answer = buildComparisonAnswer({ query: "Compare the ANC thresholds", results, routeReason: "test" });

    expect(answer).not.toBeNull();
    expect(answer?.comparisonEvaluationState).toBe("evaluated");
    expect(answer?.answer).toContain("Conflict");
    expect(answer?.answer).toContain("Protocol A: below 1.5 ×10^9/L");
    expect(answer?.answer).toContain("Protocol B: below 1.0 ×10^9/L");
    expect(answer?.answer).toContain("Protocol C: no evidence found");
    expect(answer?.citations.map((citation) => citation.chunk_id)).toEqual(["chunk-a", "chunk-b"]);
    expect(answer?.answerSections?.[0]?.citation_chunk_ids).toEqual(["chunk-a", "chunk-b"]);
  });
});

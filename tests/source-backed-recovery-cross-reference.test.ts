import { describe, expect, it } from "vitest";

import { finalizeRagAnswerQuality } from "../src/lib/rag-extractive-answer";
import type { RagAnswer, RetrievalSelectionSummary } from "../src/lib/types";

function strongSourceSelection(): RagAnswer["smartApiPlan"] {
  const sourceSelection = {
    candidateCount: 4,
    selectedCount: 3,
    requiredSignalsSatisfied: true,
    matchedSignals: ["document_title", "patient_education", "table"],
    missingRequiredSignals: [],
    rescueApplied: false,
    topChunkTypes: { text: 2, table: 1, flowchart: 0, medication_chart: 0, patient_education: 2 },
  } satisfies RetrievalSelectionSummary;
  return { answerPlan: { sourceSelection } } as unknown as RagAnswer["smartApiPlan"];
}

describe("source-backed recovery cross-reference guard", () => {
  it("does not promote a bare refer-elsewhere redirect to a grounded answer", () => {
    const answer = finalizeRagAnswerQuality(
      {
        answer:
          "Refer to the RKPG Guidelines to Writing for Clinical Policy for further information about Scope of Practice.",
        grounded: true,
        confidence: "low",
        citations: [
          {
            chunk_id: "discharge-1",
            document_id: "discharge-doc",
            title: "Admission to Discharge for Mental Health Inpatients",
            file_name: "Admission to Discharge.pdf",
            page_number: 3,
            chunk_index: 0,
          },
        ],
        sources: [],
        routingMode: "extractive",
        routingReason: "high_confidence_extractive_retrieval",
        smartApiPlan: strongSourceSelection(),
      },
      "What should discharge documentation include?",
      "broad_summary",
    );

    expect(answer.grounded).toBe(false);
    expect(answer.routingReason).toContain("final_quality_gate:missing_query_overlap");
    expect(answer.routingReason).not.toContain("source_backed_recovery");
    expect(answer.answer).not.toMatch(/RKPG|Refer to the/i);
  });
});

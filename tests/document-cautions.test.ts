import { describe, expect, it } from "vitest";

import { documentCautionFor } from "@/lib/document-cautions";
import {
  frontendSourceGovernanceWarnings,
  hasDangerSourceGovernanceWarning,
  sourceGovernanceWarnings,
} from "@/lib/source-governance";
import { SOURCE_GOVERNANCE_CODES, type SearchResult } from "@/lib/types";

// Ledger #7VQ5RC: the RkPG clozapine policy appears to label neutrophil thresholds as WBC.
// The error is in the source, so re-indexing cannot fix it; a caution travels with the citation.
const RKPG = "Clozapine Therapy - Initiation, Continuation and Ceasing Policy and Procedure (RKPG).pdf";

function result(fileName: string): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: fileName.replace(/\.pdf$/, ""),
    file_name: fileName,
    page_number: 16,
    chunk_index: 0,
    section_heading: null,
    content: "Neutropenia WBC < 1.5 x 10 9/L",
    image_ids: [],
    similarity: 0.8,
  } as unknown as SearchResult;
}

describe("document cautions", () => {
  it("matches the RkPG clozapine policy and no other clozapine guideline", () => {
    expect(documentCautionFor({ file_name: RKPG })?.ledger).toBe("#7VQ5RC");
    expect(documentCautionFor({ file_name: "Clozapine Prescribing (NMHS).pdf" })).toBeNull();
    expect(documentCautionFor({ title: "RKPG Lithium Therapy" })).toBeNull();
  });

  it("shows a visible caution on an answer citing the document, without refusing the answer", () => {
    const warnings = sourceGovernanceWarnings({ results: [result(RKPG)] });
    const caution = warnings.find((warning) => warning.code === SOURCE_GOVERNANCE_CODES.DOCUMENT_CAUTION);
    expect(caution?.message).toContain("page 16");
    expect(caution?.message).toContain("WBC is below 3.0");
    expect(caution?.severity).toBe("warning");
    expect(frontendSourceGovernanceWarnings(warnings)).toContainEqual(caution);
    expect(hasDangerSourceGovernanceWarning(warnings.filter((w) => w.code === caution?.code))).toBe(false);
  });

  it("adds nothing for an unrelated document", () => {
    const warnings = sourceGovernanceWarnings({ results: [result("Lithium Guideline (NMHS).pdf")] });
    expect(warnings.some((warning) => warning.code === SOURCE_GOVERNANCE_CODES.DOCUMENT_CAUTION)).toBe(false);
  });
});

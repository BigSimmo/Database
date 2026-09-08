import { describe, expect, it } from "vitest";
import {
  buildExtractiveAnswer,
  finalizeRagAnswerQuality,
  generatedAnswerQualityFailureReason,
} from "../src/lib/rag/rag-extractive-answer";
import { classifyRagQuery } from "../src/lib/clinical-search";
import type { RagAnswer, SearchResult } from "../src/lib/types";

// Minimal public-policy excerpts from the cache-bypassed 2026-09-07 capture of the
// three fallback cases in canary 34111344454. The full diagnostic stays local.
const CLOZAPINE_QUERIES = [
  "What safety monitoring is required for clozapine?",
  "Which observations and blood monitoring are needed while a patient is taking clozapine?",
];
const NOCC_QUERY = "What are NOCC requirements?";
const NOCC_DIRECTIVE =
  "Clinical staff are required to record data collected in compliance with the National Outcome\n" +
  "Case Mix Collection (NOCC) protocol into PSOLIS.";

function source(id: string, content: string, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    document_id: id,
    title: "Clozapine Prescribing, Administering and Monitoring",
    file_name: "Clozapine Prescribing, Administration and Monitoring (AKG).pdf",
    page_number: 8,
    chunk_index: 0,
    content,
    image_ids: [],
    images: [],
    similarity: 0.94,
    hybrid_score: 0.96,
    ...overrides,
  } as SearchResult;
}

function noccSource(id: string, content: string, overrides: Partial<SearchResult> = {}) {
  return source(id, content, {
    title: "National Outcomes and Casemix Collection (NOCC)",
    file_name: "National Outcomes and Casemix Collection (NOCC) (AKG).pdf",
    ...overrides,
  });
}

function answerFor(query: string, results: SearchResult[], allowSourceProseRecovery = true) {
  const queryClass = classifyRagQuery(query).queryClass;
  const answer = buildExtractiveAnswer({
    query,
    queryClass,
    results,
    quoteCards: [],
    documentBreakdown: [],
    evidenceSummary: undefined as unknown as RagAnswer["evidenceSummary"],
    sourceCoverage: undefined as unknown as RagAnswer["sourceCoverage"],
    conflictsOrGaps: [],
    visualEvidence: [],
    bestSource: null,
    smartPanel: undefined as unknown as RagAnswer["smartPanel"],
    relatedDocuments: [],
    routeReason: "high_confidence_extractive_retrieval",
    timings: {},
    allowSourceProseRecovery,
  });
  return finalizeRagAnswerQuality(answer, query, queryClass, results);
}

const noccHeading = () =>
  noccSource("nocc-heading", "Appendix 1: AMHCC and NOCC Measures Process Map Template - Acute Inpatient Setting", {
    retrieval_synopsis:
      "Section: Acute Inpatient Setting > Government of Western Australia > North Metropolitan Health Service > Mental Health, Public Health and Dental Services > Appendix 1: AMHCC and NOCC Measures Process Map Template > Risk assessment",
  });

describe("source-prose recovery after a rejected guidance wrapper", () => {
  it.each(CLOZAPINE_QUERIES)("recovers a complete, cited monitoring statement: %s", (query) => {
    const heading = source("clozapine-heading", "Clozapine Prescribing, Administering and Monitoring", {
      retrieval_synopsis:
        "Overdue blood test results > The relevant monitoring service automatically alerts the service, registered doctors and > 11. Therapy Interruption",
    });
    const clinic = source(
      "clozapine-clinic",
      "• Clinic based assessments are to be completed on a weekly or monthly basis, aligning\n" +
        "with the consumers blood test due dates to ensure continuity of prescription and\n" +
        "supply of Clozapine.",
      { title: "Clozapine monitoring in the community", similarity: 0.91, hybrid_score: 0.94 },
    );
    const answer = answerFor(query, [heading, clinic]);
    expect(answer.grounded).toBe(true);
    expect(answer.answer.replace(/\*\*/g, "").toLowerCase()).toContain(
      "clinic based assessments are to be completed on a weekly or monthly basis, aligning with the consumers blood test due dates to ensure continuity of prescription and supply of clozapine.",
    );
    expect(answer.citations.map((citation) => citation.chunk_id)).toEqual([clinic.id]);
    expect(answer.sources.map((result) => result.id)).toEqual([clinic.id]);
    expect(answer.routingReason).toContain("source_prose_recovery");
    expect(answer.answer).not.toContain("guidance");
    expect(generatedAnswerQualityFailureReason(answer, query, classifyRagQuery(query).queryClass)).toBeNull();
  });

  it("recovers the NOCC recording obligation across its wrapped proper name", () => {
    const policy = noccSource("nocc-policy", NOCC_DIRECTIVE);
    const measures = noccSource(
      "nocc-measures",
      "Measures will be completed by clinicians in accordance with the requirement of the NOCC\n" +
        "protocol identified above and at times identified by Appendix 2.",
    );
    const answer = answerFor(NOCC_QUERY, [noccHeading(), policy, measures]);
    expect(answer.grounded, JSON.stringify({ answer: answer.answer, reason: answer.routingReason })).toBe(true);
    expect(answer.answer.replace(/\*\*/g, "")).toContain(NOCC_DIRECTIVE.replace("\n", " "));
    expect(answer.answer.replace(/\*\*/g, "")).toContain(measures.content.replace("\n", " "));
    expect(answer.citations.map((citation) => citation.chunk_id)).toEqual([policy.id, measures.id]);
    expect(answer.sources.map((result) => result.id)).toEqual([policy.id, measures.id]);
    expect(generatedAnswerQualityFailureReason(answer, NOCC_QUERY, "document_lookup")).toBeNull();
  });

  it("leaves the routing probe unchanged until fallback recovery is explicitly enabled", () => {
    const answer = answerFor(NOCC_QUERY, [noccHeading(), noccSource("nocc-policy", NOCC_DIRECTIVE)], false);
    expect(answer.grounded).toBe(false);
    expect(answer.routingReason).not.toContain("source_prose_recovery");
  });

  it.each([
    ["paragraph", NOCC_DIRECTIVE.replace("\n", "\n\n")],
    ["numbered heading", NOCC_DIRECTIVE.replace("\n", "\n5. Training requirements\n")],
    ["bullet", NOCC_DIRECTIVE.replace("\n", "\n• ")],
    ["capitalized row", NOCC_DIRECTIVE.replace("\n", "\nTraining requirements\n")],
  ])("keeps %s boundaries when no complete obligation survives", (_boundary, content) => {
    const answer = answerFor(NOCC_QUERY, [noccHeading(), noccSource("broken-policy", content)]);
    expect(answer.grounded).toBe(false);
    expect(answer.answer).not.toContain("into PSOLIS");
  });

  it("does not join the wrapped obligation across source chunks", () => {
    const [first, second] = NOCC_DIRECTIVE.split("\n");
    const answer = answerFor(NOCC_QUERY, [noccHeading(), noccSource("first", first), noccSource("second", second)]);
    expect(answer.grounded).toBe(false);
  });

  it("does not recover from a synopsis when the source body has no complete obligation", () => {
    const answer = answerFor(NOCC_QUERY, [
      noccHeading(),
      noccSource("metadata-only", "NOCC requirements", { retrieval_synopsis: NOCC_DIRECTIVE }),
    ]);
    expect(answer.grounded).toBe(false);
  });

  it("preserves an already valid answer instead of replacing it with recovered prose", () => {
    const direct = noccSource("direct", NOCC_DIRECTIVE.replace("\n", " "));
    const answer = answerFor(NOCC_QUERY, [direct]);
    expect(answer.grounded).toBe(true);
    expect(answer.answer).toBe(direct.content);
    expect(answer.citations.map((citation) => citation.chunk_id)).toEqual([direct.id]);
  });
});

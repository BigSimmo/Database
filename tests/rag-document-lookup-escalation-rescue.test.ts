import { describe, expect, it } from "vitest";
import {
  applySecondStageRerankIfNeeded,
  decideTextFastPath,
  shouldAttemptDocumentLookupFastPath,
} from "../src/lib/rag/rag";
import { analyzeClinicalQuery, classifyRagQuery, rankClinicalResults } from "../src/lib/clinical-search";
import { selectRetrievalEvidence } from "../src/lib/retrieval-selection";
import { resultsHaveReleaseRankScore, stabilizeReleasedSearchOrder } from "../src/lib/released-search-order";
import type { SearchTelemetry } from "../src/lib/rag/rag-contracts";
import type { SearchResult } from "../src/lib/types";

// Option A (2026-07-21): title-supported escalation rescue. The live case
// neuroleptic-side-effect-escalation failed the citation gate on every canary
// (#57-#60): the query misclassifies as medication_dose_risk, its honest
// lexical pool fails the dose fast-path floor (decideTextFastPath 0.66/0.055),
// and the S3 document-lookup title layer that would surface the title-named
// SOP never ran because shouldAttemptDocumentLookupFastPath allowlisted only
// document_lookup | broad_summary | table_threshold | comparison. The rescue
// engages the layer for medication_dose_risk ONLY when the classifier's
// existing deterministic signals say the query is escalation-shaped
// (intent === "escalation_risk", assigned only when drug_dosing wording did
// NOT match) AND a curated title alias phrase is present for the alias tier to
// rescue with (documentTitleTerms > 0).

type QueryClass = ReturnType<typeof classifyRagQuery>["queryClass"];

const escalationQuery = "When should neuroleptic side effects be escalated?";

// Mirrors the production pipeline exactly as tests/rag-fast-path-ordering.test.ts
// does: rankClinicalResults → selectRetrievalEvidence → applySecondStageRerankIfNeeded
// → stabilizeReleasedSearchOrder.
function runOrderingPipeline(args: {
  query: string;
  queryClass: QueryClass;
  candidates: SearchResult[];
  topK: number;
}): SearchResult[] {
  const selection = selectRetrievalEvidence({
    query: args.query,
    queryClass: args.queryClass,
    results: rankClinicalResults(args.query, args.candidates),
    topK: args.topK,
    maxResultsPerDocument: 4,
  });
  const reranked = applySecondStageRerankIfNeeded({
    queryClass: args.queryClass,
    results: selection.results,
    telemetry: {} as SearchTelemetry,
    topK: args.topK,
  });
  stabilizeReleasedSearchOrder(reranked, resultsHaveReleaseRankScore(reranked));
  return reranked;
}

// Honest S1 text-fast-path shape for the wrong sibling doc, pinned to the
// live-measured pool the dose floor rejected (strongest 0.184 / topTextRank
// 0.0125 vs the 0.66/0.055 floor).
function zuclopenthixolS1(id: string, chunkIndex: number, content: string): SearchResult {
  return {
    id,
    document_id: "zuclopenthixol-doc",
    title: "Zuclopenthixol Acuphase (AKG)",
    file_name: "Zuclopenthixol Acuphase (AKG).pdf",
    page_number: 2,
    chunk_index: chunkIndex,
    section_heading: "Administration",
    content,
    image_ids: [],
    images: [],
    similarity: 0,
    text_rank: 0.0125,
    hybrid_score: 0.184,
  };
}

// Vector-leg shape for the injected sibling (the live top source).
function zuclopenthixolVector(id: string, content: string): SearchResult {
  return {
    id,
    document_id: "zuclopenthixol-doc",
    title: "Zuclopenthixol Acuphase (AKG)",
    file_name: "Zuclopenthixol Acuphase (AKG).pdf",
    page_number: 3,
    chunk_index: 9,
    section_heading: "Adverse effects",
    content,
    image_ids: [],
    images: [],
    similarity: 0.62,
    text_rank: 0.02,
    hybrid_score: 0.78,
    similarity_origin: "cosine",
  };
}

// S3 document-lookup title-alias chunk shape, values pinned to production
// (rag-candidate-sources.ts searchDocumentLookupFastPath: alias tier text_rank
// 0.34, similarity min(0.92, 0.58 + 0.34 + chunk bonus), hybrid 0.94,
// similarity_origin "synthetic_text").
function neurolepticS3(id: string, chunkIndex: number, heading: string, content: string): SearchResult {
  return {
    id,
    document_id: "neuroleptic-doc",
    title: "Neuroleptic Side Effects (AKG)",
    file_name: "Neuroleptic Side Effects (AKG).pdf",
    page_number: 1,
    chunk_index: chunkIndex,
    section_heading: heading,
    content,
    image_ids: [],
    images: [],
    similarity: 0.92,
    text_rank: 0.34,
    hybrid_score: 0.94,
    similarity_origin: "synthetic_text",
  };
}

function neurolepticPool(): SearchResult[] {
  return [
    neurolepticS3(
      "neuroleptic-1",
      0,
      "Escalation",
      "Escalate neuroleptic side effects to the treating psychiatrist when symptoms are severe, progressive, or accompanied by fever or rigidity.",
    ),
    neurolepticS3(
      "neuroleptic-2",
      1,
      "Monitoring and escalation",
      "Contact the duty medical officer urgently if neuroleptic malignant syndrome is suspected; cease the antipsychotic and escalate care.",
    ),
    neurolepticS3(
      "neuroleptic-3",
      2,
      "Side effect review",
      "Document neuroleptic side effects at each review and escalate persistent extrapyramidal symptoms for specialist assessment.",
    ),
  ];
}

function zuclopenthixolLexicalPool(): SearchResult[] {
  return [
    zuclopenthixolS1("zuclo-1", 0, "Zuclopenthixol acuphase doses must be prescribed by a consultant psychiatrist."),
    zuclopenthixolS1("zuclo-2", 1, "Observe the patient after each zuclopenthixol acuphase dose is administered."),
  ];
}

function zuclopenthixolMergedPool(): SearchResult[] {
  return [
    ...zuclopenthixolLexicalPool(),
    zuclopenthixolVector(
      "zuclo-3",
      "Common adverse effects of zuclopenthixol include sedation and extrapyramidal symptoms.",
    ),
  ];
}

describe("escalation-rescue gate predicate", () => {
  it("fires for the title-supported escalation-shaped medication_dose_risk query", () => {
    const analysis = analyzeClinicalQuery(escalationQuery);
    // Pin the mechanism-chain premises so classifier drift is loud.
    expect(analysis.queryClass).toBe("medication_dose_risk");
    expect(analysis.intent).toBe("escalation_risk");
    expect(analysis.documentTitleTerms.length).toBeGreaterThan(0);
    expect(shouldAttemptDocumentLookupFastPath(analysis.queryClass, analysis)).toBe(true);
  });

  it("never fires for pure dose/route/frequency questions", () => {
    for (const query of [
      "What is the maximum sertraline dose?",
      "Show the clozapine missed-dose monitoring table guidance.",
      "What agitation medication can be given IM?",
    ]) {
      const analysis = analyzeClinicalQuery(query);
      expect(shouldAttemptDocumentLookupFastPath("medication_dose_risk", analysis)).toBe(false);
    }
  });

  it("never fires for escalation wording without a curated title alias", () => {
    const analysis = analyzeClinicalQuery("What are naltrexone contraindications?");
    expect(analysis.documentTitleTerms.length).toBe(0);
    expect(shouldAttemptDocumentLookupFastPath("medication_dose_risk", analysis)).toBe(false);
  });

  it("never fires for title-supported non-escalation questions", () => {
    const analysis = analyzeClinicalQuery(
      "Which observations and blood monitoring are needed while a patient is taking clozapine?",
    );
    expect(analysis.intent).not.toBe("escalation_risk");
    expect(shouldAttemptDocumentLookupFastPath("medication_dose_risk", analysis)).toBe(false);
  });

  it("keeps the four allowlisted classes engaged with and without analysis", () => {
    for (const queryClass of ["document_lookup", "broad_summary", "table_threshold", "comparison"] as const) {
      expect(shouldAttemptDocumentLookupFastPath(queryClass)).toBe(true);
      expect(shouldAttemptDocumentLookupFastPath(queryClass, analyzeClinicalQuery("random query"))).toBe(true);
    }
    expect(shouldAttemptDocumentLookupFastPath("unsupported_or_general")).toBe(false);
  });
});

describe("escalation rescue end-to-end ordering", () => {
  it("surfaces the title-named SOP above the vector-injected sibling once the gate admits S3 candidates", () => {
    const analysis = analyzeClinicalQuery(escalationQuery);
    // The pool is constructed THROUGH the production gate, so this test is red
    // while the gate excludes medication_dose_risk: without the S3 candidates
    // the sibling doc tops the release order and the rescue assertions fail.
    const pool = shouldAttemptDocumentLookupFastPath(analysis.queryClass, analysis)
      ? [...zuclopenthixolMergedPool(), ...neurolepticPool()]
      : [...zuclopenthixolMergedPool()];

    const released = runOrderingPipeline({
      query: escalationQuery,
      queryClass: analysis.queryClass,
      candidates: pool,
      topK: 8,
    });

    expect(released[0]?.document_id).toBe("neuroleptic-doc");
    const topFiveNeuroleptic = released.slice(0, 5).filter((result) => result.document_id === "neuroleptic-doc");
    // minCitations 2 for the live case: at least two citable chunks of the
    // rescued doc must reach the released top-5.
    expect(topFiveNeuroleptic.length).toBeGreaterThanOrEqual(2);
    // Conservative availability: the sibling stays retrievable, just not on top.
    expect(released.some((result) => result.document_id === "zuclopenthixol-doc")).toBe(true);
    // The dose fast-path floor now passes on the rescued pool (0.94 >= 0.66).
    expect(decideTextFastPath(escalationQuery, released, analysis.queryClass).returnFastPath).toBe(true);

    // Arrival-order invariance: byte-identical S3 primaries must not depend on
    // candidate insertion order.
    const reversed = runOrderingPipeline({
      query: escalationQuery,
      queryClass: analysis.queryClass,
      candidates: [...pool].reverse(),
      topK: 8,
    });
    expect(reversed.map((result) => result.id)).toEqual(released.map((result) => result.id));
  });

  it("documents the pre-rescue floor rejection of the honest lexical pool", () => {
    // Chain link 2 as executable documentation: without the S3 candidates the
    // sibling-only pool fails the medication_dose_risk fast-path floor.
    const decision = decideTextFastPath(escalationQuery, zuclopenthixolLexicalPool(), "medication_dose_risk");
    expect(decision.returnFastPath).toBe(false);
  });

  it("keeps non-firing dose-shaped pools byte-identical", () => {
    const doseQuery = "What is the usual lithium dose for maintenance?";
    const analysis = analyzeClinicalQuery(doseQuery);
    expect(shouldAttemptDocumentLookupFastPath("medication_dose_risk", analysis)).toBe(false);

    const pool = [
      zuclopenthixolS1("lithium-1", 0, "Lithium maintenance dosing is 250 mg twice daily for most adults."),
      zuclopenthixolS1("lithium-2", 1, "Adjust the lithium dose according to trough levels."),
    ].map((result, index) => ({
      ...result,
      id: `lithium-${index + 1}`,
      document_id: "lithium-doc",
      title: "Lithium (AKG)",
      file_name: "Lithium (AKG).pdf",
    }));

    const released = runOrderingPipeline({
      query: doseQuery,
      queryClass: "medication_dose_risk",
      candidates: pool,
      topK: 8,
    });
    const releasedAgain = runOrderingPipeline({
      query: doseQuery,
      queryClass: "medication_dose_risk",
      candidates: pool,
      topK: 8,
    });
    expect(released.map((result) => result.id)).toEqual(releasedAgain.map((result) => result.id));
  });
});

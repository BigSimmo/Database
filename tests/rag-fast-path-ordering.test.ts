import { describe, expect, it } from "vitest";
import { applySecondStageRerankIfNeeded } from "../src/lib/rag";
import { classifyRagQuery, rankClinicalResults } from "../src/lib/clinical-search";
import { selectRetrievalEvidence } from "../src/lib/retrieval-selection";
import { resultsHaveReleaseRankScore, stabilizeReleasedSearchOrder } from "../src/lib/released-search-order";
import type { SearchTelemetry } from "../src/lib/rag-contracts";
import type { SearchResult } from "../src/lib/types";

// Regression guards for the 2026-07-19 live golden-retrieval failures (the raw #901
// ordering, remediated same-day by #913-#926). On the embedding-free text fast path,
// table/text candidates carry IMPUTED primaries derived only from Postgres text_rank
// (rag-candidate-sources.ts: similarity = 0.62 + min(text_rank, 1) * 0.3), so unrelated
// documents matching the same query terms collapse to byte-identical vector/text/hybrid
// scores and only content-aware ranking can separate them. Each test replays one failed
// eval case's shape through the production ordering pipeline. Guard surface: the CIWA
// case is the one whose top-1 assertion binds the selection contentCoverageScore tie-break
// (its candidates tie on every clamped key); the lithium/clozapine/safety-plan cases win
// earlier (subject boosts, table-type boosts, hybrid+id release order) and guard the
// remediation stack end-to-end rather than the tie-break itself.

type QueryClass = ReturnType<typeof classifyRagQuery>["queryClass"];

function imputedResult(
  overrides: Partial<SearchResult> & Pick<SearchResult, "id" | "document_id" | "title" | "file_name" | "content">,
): SearchResult {
  return {
    page_number: 5,
    chunk_index: 0,
    section_heading: null,
    image_ids: [],
    images: [],
    similarity: 0.755,
    text_rank: 0.45,
    hybrid_score: 0.795,
    ...overrides,
  };
}

// Mirrors the production text-fast-path ordering pipeline: selectRankedRetrievalResults
// (rag.ts — rankClinicalResults + selectRetrievalEvidence) → applySecondStageRerankIfNeeded
// → the recordSearchScoreTelemetry release ordering (stabilizeReleasedSearchOrder keyed on
// resultsHaveReleaseRankScore). Supabase-only hydration and the default-off semantic rerank
// are the only production stages skipped; neither reorders deterministic results.
function runTextFastPathOrdering(args: {
  query: string;
  queryClass: QueryClass;
  candidates: SearchResult[];
  topK: number;
  maxResultsPerDocument?: number;
}): SearchResult[] {
  const selection = selectRetrievalEvidence({
    query: args.query,
    queryClass: args.queryClass,
    results: rankClinicalResults(args.query, args.candidates),
    topK: args.topK,
    maxResultsPerDocument: args.maxResultsPerDocument ?? 4,
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

function normalizedDocumentName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topFiveEvidenceText(results: SearchResult[]): string {
  return results
    .slice(0, 5)
    .map((result) =>
      [
        result.content,
        ...(result.table_facts ?? []).flatMap((fact) => [fact.action, fact.threshold_value, fact.row_label]),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
}

describe("text-fast-path ordering under imputed identical primaries", () => {
  it("ranks the medication-subject document above generic monitoring documents (lithium-therapy-monitoring)", () => {
    const query = "What monitoring is required for lithium therapy?";
    const { queryClass } = classifyRagQuery(query);
    expect(queryClass).toBe("medication_dose_risk");

    const wrongSubjectDocs = [
      imputedResult({
        id: "haemophilia-p5",
        document_id: "haemophilia-doc",
        title: "Acquired Haemophilia A Management",
        file_name: "AcquiredHaemophiliaAManagement (FSH).pdf",
        section_heading: "Immunosuppressive therapy treatment options",
        content:
          "Monitor for adverse events during immunosuppressive therapy. Baseline blood pressure and glucose monitoring is required for corticosteroid therapy.",
      }),
      imputedResult({
        id: "methotrexate-p5",
        document_id: "methotrexate-doc",
        title: "Methotrexate for IBD Guideline",
        file_name: "MethotrexateForIBDGuideline (NMHS).pdf",
        section_heading: "Monitoring requirements",
        content:
          "Full blood count and liver function monitoring is required during methotrexate therapy. Repeat baseline blood tests after dose changes.",
      }),
      imputedResult({
        id: "cardiac-p5",
        document_id: "cardiac-doc",
        title: "Continuous Cardiac Monitoring Requirements",
        file_name: "ContinuousCardiacMonitoringRequirements (SMHS).pdf",
        section_heading: "Monitoring during therapy",
        content:
          "Continuous cardiac monitoring is required during therapy titration. Record baseline observations and monitor levels every hour.",
      }),
    ];
    const lithiumDoc = imputedResult({
      id: "lithium-p9",
      document_id: "lithium-doc",
      title: "Mood Stabiliser Guideline",
      file_name: "MoodStabiliserGuideline (SMHS).pdf",
      page_number: 9,
      content:
        "Serum lithium level should be checked 12 hours after the last dose during maintenance therapy, with renal function and thyroid function tests every six months.",
    });

    const candidates = [...wrongSubjectDocs, lithiumDoc];
    const released = runTextFastPathOrdering({ query, queryClass, candidates, topK: 12 });

    expect(released[0]?.document_id).toBe("lithium-doc");
    expect(released.slice(0, 5).some((result) => /\blithium\b/i.test(result.content))).toBe(true);

    // The selection layer must arm the clinical_subject requirement for monitoring queries
    // (#919) and tag subject matches, because the rag.ts second-stage cap keys on these
    // exact reasons to stop wrong-medication chunks outranking the requested subject.
    const haemophilia = released.find((result) => result.document_id === "haemophilia-doc");
    const lithium = released.find((result) => result.document_id === "lithium-doc");
    expect(haemophilia?.match_explanation?.reasons).toContain("retrieval_required_signal:clinical_subject");
    expect(haemophilia?.match_explanation?.reasons).not.toContain("retrieval_signal:clinical_subject");
    expect(lithium?.match_explanation?.reasons).toContain("retrieval_signal:clinical_subject");

    // Byte-identical primaries must not make the outcome depend on candidate arrival order.
    const releasedReversed = runTextFastPathOrdering({
      query,
      queryClass,
      candidates: [...candidates].reverse(),
      topK: 12,
    });
    expect(releasedReversed[0]?.document_id).toBe("lithium-doc");
  });

  it("keeps the threshold table chunk in the released top 5 of its own document (clozapine-anc-threshold)", () => {
    const query = "What ANC or FBC threshold should withhold clozapine?";
    const { queryClass } = classifyRagQuery(query);
    expect(queryClass).toBe("table_threshold");

    const proseSiblings = [
      "Clozapine requires regular ANC and FBC checks during the first 18 weeks of treatment.",
      "Community pharmacy dispensing rules for clozapine limit supply to short intervals.",
      "Clozapine registration and consent must be recorded before commencing treatment.",
      "Patients taking clozapine should report infection symptoms so an FBC can be arranged.",
    ].map((content, index) =>
      imputedResult({
        id: `clozapine-prose-${index + 1}`,
        document_id: "clozapine-doc",
        title: "Clozapine Prescribing Administration Monitoring",
        file_name: "MHSP.ClozapinePrescribingAdministrationMonitoring.pdf",
        page_number: index + 4,
        chunk_index: index + 1,
        content,
      }),
    );
    const tableChunk = imputedResult({
      id: "clozapine-anc-table",
      document_id: "clozapine-doc",
      title: "Clozapine Prescribing Administration Monitoring",
      file_name: "MHSP.ClozapinePrescribingAdministrationMonitoring.pdf",
      page_number: 3,
      chunk_index: 5,
      section_heading: "ANC monitoring thresholds",
      content: "ANC below 1.5 requires immediate review as set out in the monitoring table.",
      table_facts: [
        {
          id: "fact-anc-1",
          document_id: "clozapine-doc",
          source_chunk_id: "clozapine-anc-table",
          source_image_id: null,
          page_number: 3,
          table_title: "Clozapine ANC monitoring thresholds",
          row_label: "ANC < 1.5",
          clinical_parameter: "ANC",
          threshold_value: "< 1.5 x 10^9/L",
          action: "Withhold clozapine and repeat FBC",
        },
      ],
    });
    const crossDocDistractor = imputedResult({
      id: "fbc-policy-p2",
      document_id: "fbc-policy-doc",
      title: "Full Blood Count Collection Policy",
      file_name: "FullBloodCountCollectionPolicy (NMHS).pdf",
      page_number: 2,
      content: "FBC collection, labelling and processing procedure for inpatient units.",
    });

    const released = runTextFastPathOrdering({
      query,
      queryClass,
      candidates: [...proseSiblings, tableChunk, crossDocDistractor],
      topK: 12,
      // Production caps non-comparison retrieval at 4 chunks per document: if the table
      // chunk loses to its prose siblings it is CUT entirely — the failure being guarded.
      maxResultsPerDocument: 4,
    });

    const topFive = released.slice(0, 5);
    const tableIndex = topFive.findIndex((result) => result.id === "clozapine-anc-table");
    expect(tableIndex).toBeGreaterThanOrEqual(0);
    for (const prose of proseSiblings) {
      const proseIndex = topFive.findIndex((result) => result.id === prose.id);
      if (proseIndex >= 0) {
        expect(tableIndex).toBeLessThan(proseIndex);
      }
    }
    expect(topFive.some((result) => (result.table_facts?.length ?? 0) > 0)).toBe(true);
    // The eval's content gate also reads table-fact action text (resultContentEvidenceText).
    expect(topFiveEvidenceText(released)).toMatch(/withhold|cease|stop/i);
  });

  it("prefers the scale document naming the threshold over the broader AOD overview (alcohol-ciwa-threshold)", () => {
    const query = "What CIWA-Ar score threshold requires drug treatment in alcohol withdrawal?";
    const { queryClass } = classifyRagQuery(query);
    expect(queryClass).toBe("table_threshold");

    const ciwaDoc = imputedResult({
      id: "ciwa-p2",
      document_id: "ciwa-doc",
      title: "Alcohol Withdrawal Scale (CIWA-Ar)",
      file_name: "Alcohol Withdrawal Scale (CIWA-Ar) (NMHS).pdf",
      page_number: 2,
      section_heading: "CIWA-Ar score thresholds",
      content: "A CIWA-Ar score of 10 or more requires drug treatment for alcohol withdrawal.",
    });
    const aodOverview = imputedResult({
      id: "aod-p6",
      document_id: "aod-doc",
      title: "Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal",
      file_name: "Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal (FSH).pdf",
      page_number: 6,
      content:
        "Assessment of intoxication, toxicity and withdrawal for alcohol and other drugs, with supportive care and monitoring principles.",
    });
    // Models the chunk that took #1 in the 2026-07-20 live golden run (eval-canary #50) when the
    // tie-break keyed on the boost-laden rankScore: screening/monitoring vocabulary earns strong
    // generic clinicalSignalBoost, its content covers several query terms (alcohol, withdrawal,
    // treatment, drug) — but none of the answer terms (ciwa/score/threshold). Query-term coverage
    // must still rank the answer-bearing scale chunk above it.
    const screeningChunk = imputedResult({
      id: "aod-screening-p1",
      document_id: "aod-doc",
      title: "Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal",
      file_name: "Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal (FSH).pdf",
      page_number: 1,
      section_heading: "Screening and treatment outcomes monitoring",
      content:
        "Use the screening tool to initially screen all patients presenting to the service, and monitor treatment outcomes for alcohol and other drug withdrawal management.",
    });

    // Offline this pins the pairwise decision among the live contenders; the live corpus depth
    // (the expected document sat at rank ~8 on 2026-07-19) is covered by the live golden eval,
    // not this fixture.
    const released = runTextFastPathOrdering({
      query,
      queryClass,
      candidates: [aodOverview, screeningChunk, ciwaDoc],
      topK: 12,
    });

    expect(released[0]?.document_id).toBe("ciwa-doc");
    const docGateSatisfied = released
      .slice(0, 5)
      .some((result) => normalizedDocumentName(`${result.title} ${result.file_name}`).includes("alcohol withdrawal"));
    expect(docGateSatisfied).toBe(true);
    // The eval's content gate for this case: at least one top-5 chunk must carry an answer term.
    expect(released.slice(0, 5).some((result) => /ciwa|score|threshold/i.test(result.content))).toBe(true);
  });

  it("ranks the pinned safety-plan document above the policy duplicate for document lookups (patient-safety-plan-include)", () => {
    const query = "What should a patient safety plan include?";
    const { queryClass } = classifyRagQuery(query);
    expect(queryClass).toBe("document_lookup");

    const pinnedPlan = imputedResult({
      id: "ptsafetyplan-p1",
      document_id: "ptsafetyplan-doc",
      title: "Patient Safety Plan",
      file_name: "PtSafetyPlan (MHSP).pdf",
      page_number: 1,
      content:
        "A patient safety plan should include warning signs, coping strategies, social contacts, and emergency contacts.",
    });
    const policyDuplicate = imputedResult({
      id: "rkpg-policy-p3",
      document_id: "rkpg-policy-doc",
      title: "Safety Planning Policy and Procedure",
      file_name: "Safety Planning Policy and Procedure (RKPG).pdf",
      page_number: 3,
      content: "Safety planning policy describing what a safety plan should include for patients at risk.",
    });

    const released = runTextFastPathOrdering({
      query,
      queryClass,
      candidates: [policyDuplicate, pinnedPlan],
      topK: 8,
    });

    expect(released[0]?.document_id).toBe("ptsafetyplan-doc");
    // Both are legitimate sources — the policy document must stay retrievable, not be dropped.
    expect(released.map((result) => result.document_id)).toContain("rkpg-policy-doc");
  });

  it("prefers the current document over an outdated twin at exact saturated ties (conservative direction)", () => {
    // The tie-break key is the full clinical rank, which includes the bounded source-governance
    // terms — so among otherwise-identical candidates the current, well-extracted document wins.
    // This pins the conservative direction of the governance component at ties.
    const query = "What monitoring is required for lithium therapy?";
    const { queryClass } = classifyRagQuery(query);
    const sharedFields = {
      title: "Mood Stabiliser Guideline",
      content:
        "Serum lithium level should be checked 12 hours after the last dose during maintenance therapy, with renal function and thyroid function tests every six months.",
    };
    const governanceMetadata = (overrides: Partial<NonNullable<SearchResult["source_metadata"]>>) => ({
      source_title: null,
      publisher: null,
      jurisdiction: null,
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current" as const,
      clinical_validation_status: "locally_reviewed" as const,
      extraction_quality: "good" as const,
      ...overrides,
    });
    const currentDoc = imputedResult({
      ...sharedFields,
      id: "guideline-current",
      document_id: "current-doc",
      file_name: "MoodStabiliserGuideline (SMHS).pdf",
      source_metadata: governanceMetadata({}),
    });
    const outdatedTwin = imputedResult({
      ...sharedFields,
      id: "guideline-archived",
      document_id: "archived-doc",
      file_name: "MoodStabiliserGuideline 2019 (SMHS).pdf",
      source_metadata: governanceMetadata({ document_status: "outdated", extraction_quality: "poor" }),
    });

    // Note "guideline-archived" < "guideline-current" lexicographically: without the
    // governance-aware tie-break the chunk-id fallback would seat the outdated twin first.
    const released = runTextFastPathOrdering({
      query,
      queryClass,
      candidates: [outdatedTwin, currentDoc],
      topK: 8,
    });

    expect(released[0]?.document_id).toBe("current-doc");
    // Conservative availability: the outdated document is demoted, not dropped.
    expect(released.map((result) => result.document_id)).toContain("archived-doc");
  });
});

import { describe, expect, it } from "vitest";
import { boldHighYieldClinicalText, rankAnswerEvidence } from "../src/lib/answer-ranking";
import { buildCrossDocumentSynthesisPlan } from "../src/lib/cross-document-synthesis";
import { parseAnswerJson } from "../src/lib/rag/rag";
import type { SearchResult } from "../src/lib/types";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: overrides.id ?? "chunk-1",
    document_id: overrides.document_id ?? "doc-1",
    title: overrides.title ?? "Guideline",
    file_name: overrides.file_name ?? "guideline.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: overrides.section_heading ?? null,
    content: overrides.content ?? "General clinical source text.",
    image_ids: [],
    similarity: overrides.similarity ?? 0.6,
    hybrid_score: overrides.hybrid_score ?? 0.6,
    images: [],
    ...overrides,
  };
}

describe("answer evidence ranking", () => {
  it("promotes a directly answering lower-score chunk over a broad higher-score chunk", () => {
    const ranking = rankAnswerEvidence("What ANC threshold should withhold clozapine?", [
      result({
        id: "broad-high-score",
        title: "Clozapine Prescribing",
        content: "Clozapine service appointments, consent, and general monitoring responsibilities.",
        hybrid_score: 0.9,
      }),
      result({
        id: "direct-lower-score",
        title: "Clozapine Prescribing",
        section_heading: "FBC and ANC monitoring",
        content: "Withhold clozapine when ANC or FBC thresholds require treatment interruption and urgent review.",
        hybrid_score: 0.62,
      }),
    ]);

    expect(ranking.rankedResults[0].id).toBe("direct-lower-score");
    expect(ranking.topScore).toBeGreaterThan(0.6);
  });

  it("prioritizes table-heavy evidence for table and threshold questions", () => {
    const ranking = rankAnswerEvidence("Which table covers agitation and arousal pharmacological management?", [
      result({
        id: "plain-text",
        title: "Agitation notes",
        content: "Agitation and arousal are mentioned in background notes.",
        hybrid_score: 0.72,
      }),
      result({
        id: "table-evidence",
        title: "Agitation and Arousal Pharmacological Management",
        content: "Table text lists rating 2-3, oral medication, intramuscular medication, and escalation steps.",
        hybrid_score: 0.58,
        images: [
          {
            id: "image-1",
            page_number: 2,
            storage_path: "private/image.png",
            caption: "Agitation and arousal pharmacological management table.",
            image_type: "clinical_table",
            searchable: true,
            sourceKind: "table_crop",
          },
        ],
      }),
    ]);

    expect(ranking.rankedResults[0].id).toBe("table-evidence");
  });

  it("supports medication-risk, document-lookup, broad-summary, and unsupported-style cases", () => {
    expect(
      rankAnswerEvidence("How should oral medication dose be managed?", [
        result({ id: "generic", content: "General ward process.", hybrid_score: 0.7 }),
        result({
          id: "dose",
          content: "Medication dose, route, oral administration, and monitoring timing are listed.",
          hybrid_score: 0.55,
        }),
      ]).rankedResults[0].id,
    ).toBe("dose");

    expect(
      rankAnswerEvidence("Find the NOCC document", [
        result({ id: "generic", title: "Generic Mental Health Document", hybrid_score: 0.7 }),
        result({ id: "nocc", title: "MHSP.NOCC", file_name: "MHSP.NOCC.pdf", hybrid_score: 0.5 }),
      ]).rankedResults[0].id,
    ).toBe("nocc");

    expect(
      rankAnswerEvidence("Summarize discharge guidance", [
        result({ id: "generic", content: "Administrative content.", hybrid_score: 0.68 }),
        result({
          id: "summary-match",
          title: "Discharge",
          document_summary: "Discharge guidance, documentation, follow-up and clinical responsibilities.",
          content: "Discharge procedure overview.",
          hybrid_score: 0.5,
        }),
      ]).rankedResults[0].id,
    ).toBe("summary-match");

    expect(
      rankAnswerEvidence("What is the diabetic ketoacidosis insulin protocol?", [
        result({
          id: "nearby",
          content: "Long acting injectable antipsychotic appointment process.",
          hybrid_score: 0.33,
        }),
      ]).topScore,
    ).toBeLessThan(0.45);
  });

  it("uses retrieval synopsis text in the combined evidence haystack", () => {
    const ranking = rankAnswerEvidence("Summarize clozapine blood monitoring observations", [
      result({
        id: "generic-higher-score",
        title: "General monitoring",
        content: "Administrative review process only.",
        hybrid_score: 0.72,
      }),
      result({
        id: "synopsis-match",
        title: "Monitoring overview",
        content: "Administrative review process only.",
        retrieval_synopsis: "Clozapine blood monitoring observations and review timing guidance.",
        hybrid_score: 0.56,
      }),
    ]);

    expect(ranking.rankedResults[0].id).toBe("synopsis-match");
  });

  it("does not let agitation title repetition outrank direct dosing evidence", () => {
    const ranking = rankAnswerEvidence("agitation and arousal dosing in psychiatric patients", [
      result({
        id: "title-repeat",
        title: "Agitation and Arousal Pharmacological Management Guideline",
        content:
          "Agitation and Arousal: Pharmacological Management Guideline - Agitation and Arousal pharmacological management for adult mental health inpatients.",
        hybrid_score: 0.94,
      }),
      result({
        id: "dosing-table",
        title: "Agitation and Arousal Pharmacological Management Guideline",
        section_heading: "Medication dose details",
        content:
          "Medication options include oral olanzapine or lorazepam, intramuscular medication when oral options are not appropriate, dose escalation limits, and monitoring after administration.",
        hybrid_score: 0.62,
      }),
    ]);

    expect(ranking.rankedResults[0].id).toBe("dosing-table");
  });

  it("retains semantic relevance as a bounded signal inside an ambiguous evidence band", () => {
    const lowSemantic = result({
      id: "low-semantic",
      content: "Clozapine monitoring guidance.",
      hybrid_score: 0.7,
      score_explanation: { semanticRerankScore: 0.1 } as NonNullable<SearchResult["score_explanation"]>,
    });
    const highSemantic = result({
      id: "high-semantic",
      content: "Clozapine monitoring guidance.",
      hybrid_score: 0.7,
      score_explanation: { semanticRerankScore: 0.9 } as NonNullable<SearchResult["score_explanation"]>,
    });

    const ranking = rankAnswerEvidence("clozapine monitoring guidance", [lowSemantic, highSemantic]);

    expect(ranking.rankedResults.map((item) => item.id)).toEqual(["high-semantic", "low-semantic"]);
    expect(ranking.scoresByChunkId.get("high-semantic")).toBeGreaterThan(
      ranking.scoresByChunkId.get("low-semantic") ?? 0,
    );
  });

  it("uses the app-layer rank only as a final answer-evidence tie-breaker", () => {
    const lowerRank = result({
      id: "lower-rank",
      content: "Lithium dosing guidance.",
      hybrid_score: 0.7,
      score_explanation: { rankScore: 0.8 } as NonNullable<SearchResult["score_explanation"]>,
    });
    const higherRank = result({
      id: "higher-rank",
      content: "Lithium dosing guidance.",
      hybrid_score: 0.7,
      score_explanation: { rankScore: 1.1 } as NonNullable<SearchResult["score_explanation"]>,
    });

    const ranking = rankAnswerEvidence("lithium dosing guidance", [lowerRank, higherRank]);

    expect(ranking.rankedResults.map((item) => item.id)).toEqual(["higher-rank", "lower-rank"]);
    expect(ranking.scoresByChunkId.get("higher-rank")).toBe(ranking.scoresByChunkId.get("lower-rank"));
  });

  it("retains both admission and discharge evidence through deterministic comparison packing", () => {
    // Replays the document/order/score shape from current-main canary run 30009207429.
    // If this stays green while a live answer omits Admission of Community Patients,
    // the loss occurred after deterministic ranking/packing and must not be "fixed"
    // with a speculative retrieval-score or comparator change.
    const ranking = rankAnswerEvidence("Compare admission and discharge requirements", [
      result({
        id: "combined-policy",
        document_id: "combined-policy-doc",
        title: "Referral, Admission And Discharge - Mental Health Hospital In The Home",
        file_name: "referral-admission-discharge.pdf",
        content: "Referral procedure, consultant acceptance and patient-flow allocation.",
        hybrid_score: 0.2898,
        score_explanation: { rankScore: 1.5365 } as NonNullable<SearchResult["score_explanation"]>,
      }),
      result({
        id: "discharge-community",
        document_id: "discharge-community-doc",
        title: "Discharge Planning For Community Patients",
        file_name: "discharge-planning-community-patients.pdf",
        content: "Relapse and admission principles set expectations for community treatment and discharge planning.",
        hybrid_score: 0.3892,
        score_explanation: { rankScore: 1.1365 } as NonNullable<SearchResult["score_explanation"]>,
      }),
      result({
        id: "discharge-community-sibling",
        document_id: "discharge-community-doc",
        title: "Discharge Planning For Community Patients",
        file_name: "discharge-planning-community-patients.pdf",
        content: "Community staff document the discharge plan and ongoing care arrangements.",
        hybrid_score: 0.3882,
        score_explanation: { rankScore: 1.0204 } as NonNullable<SearchResult["score_explanation"]>,
      }),
      result({
        id: "admission-community",
        document_id: "admission-community-doc",
        title: "Admission Of Community Patients",
        file_name: "Admission of Community Patients (AKG).pdf",
        content:
          "The patient-flow framework covers police assistance, escorted admissions and high-observation bed capacity.",
        hybrid_score: 0.376,
        score_explanation: { rankScore: 1.3325 } as NonNullable<SearchResult["score_explanation"]>,
      }),
      result({
        id: "admission-community-sibling",
        document_id: "admission-community-doc",
        title: "Admission Of Community Patients",
        file_name: "Admission of Community Patients (AKG).pdf",
        content:
          "The patient-flow framework covers police assistance, escorted admissions and high-observation bed capacity.",
        hybrid_score: 0.3757,
        score_explanation: { rankScore: 1.3082 } as NonNullable<SearchResult["score_explanation"]>,
      }),
      result({
        id: "patient-discharge",
        document_id: "patient-discharge-doc",
        title: "Patient Discharge Policy And Procedure",
        content: "Discharge requirements include clinical handover, referral and documented follow-up.",
        hybrid_score: 0.2847,
        score_explanation: { rankScore: 0.9318 } as NonNullable<SearchResult["score_explanation"]>,
      }),
      result({
        id: "falls-distractor",
        document_id: "falls-doc",
        title: "Falls Prevention And Management",
        content: "Rehabilitation discharge planning and progress notes are documented after medical review.",
        hybrid_score: 0.2361,
        score_explanation: { rankScore: 0.6534 } as NonNullable<SearchResult["score_explanation"]>,
      }),
    ]);

    const packed = buildCrossDocumentSynthesisPlan(
      "Compare admission and discharge requirements",
      ranking.rankedResults,
      "comparison",
    ).results.slice(0, 5);
    expect(packed.some((item) => item.document_id === "admission-community-doc")).toBe(true);
    expect(packed.some((item) => /discharge/i.test(`${item.title} ${item.content}`))).toBe(true);
  });
});

describe("high-yield answer bolding", () => {
  it("bolds only values and actions, not topic nouns or query terms", () => {
    const formatted = boldHighYieldClinicalText(
      "Withhold clozapine when FBC is unsafe and repeat review after 4 hours. Existing **ANC** stays stable.",
      "What FBC threshold should withhold clozapine?",
    );

    // Decision-critical detail stays bolded: the stop action and the timing value.
    expect(formatted).toContain("**Withhold**");
    expect(formatted).toContain("**4 hours**");
    // Topic nouns (and query terms) are no longer bolded — they read as keyword noise.
    expect(formatted).not.toContain("**clozapine**");
    expect(formatted).not.toContain("**FBC**");
    // Pre-existing markdown is preserved and not double-bolded.
    expect(formatted).toContain("Existing **ANC** stays stable.");
    expect(formatted).not.toContain("****ANC****");
  });

  it("applies high-yield bolding to structured model answers and sections", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Withhold clozapine when FBC is unsafe.",
        grounded: true,
        confidence: "high",
        answerSections: [
          {
            heading: "Escalation",
            body: "Urgent review is required within 4 hours.",
            citation_chunk_ids: ["chunk-1"],
          },
        ],
        citations: [{ chunk_id: "chunk-1" }],
        quoteCards: [],
        conflictsOrGaps: [],
      }),
      [
        result({
          id: "chunk-1",
          content: "Withhold clozapine when FBC is unsafe and arrange urgent review within 4 hours.",
          similarity: 0.9,
        }),
      ],
      "What FBC threshold should withhold clozapine?",
    );

    expect(answer.answer).toContain("**Withhold**");
    expect(answer.answer).not.toContain("**clozapine**");
    expect(answer.answer).not.toContain("**FBC**");
    expect(answer.answerSections?.[0]?.body).toContain("**4 hours**");
  });

  it("removes clipped trailing fragments from generated answer sections", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Use CBT with nutritional support.",
        grounded: true,
        confidence: "high",
        answerSections: [
          {
            heading: "Adjunct medication",
            body: "SSRIs may be used as adjunct treatment when supported by the source. Escalation may follow if a 60% decrease in b",
            citation_chunk_ids: ["chunk-1"],
          },
        ],
        citations: [{ chunk_id: "chunk-1" }],
        quoteCards: [],
        conflictsOrGaps: [],
      }),
      [
        result({
          id: "chunk-1",
          content: "SSRIs may be used as adjunct treatment when supported by the source.",
          similarity: 0.9,
        }),
      ],
      "management of bulimia nervosa",
    );

    expect(answer.answerSections?.[0]?.body.replace(/\*\*/g, "")).toBe(
      "SSRIs may be used as adjunct treatment when supported by the source.",
    );
  });
});

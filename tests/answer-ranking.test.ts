import { describe, expect, it } from "vitest";
import { boldHighYieldClinicalText, rankAnswerEvidence } from "../src/lib/answer-ranking";
import { parseAnswerJson } from "../src/lib/rag";
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

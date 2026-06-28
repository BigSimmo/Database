import { describe, expect, it } from "vitest";
import { analyzeClinicalQuery } from "../src/lib/clinical-search";
import {
  buildRetrievalQueryVariants,
  decideTextFastPath,
  evaluateEvidenceCoverageGate,
  retrievalPlanCacheQuery,
  selectRagAliasExpansions,
  shouldApplyUnsupportedSearchShortCircuit,
  textCandidateBudgetForQueryClass,
} from "../src/lib/rag";
import type { SearchResult } from "../src/lib/types";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Patient Safety Plan",
    file_name: "patient-safety-plan.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: "Safety plan content.",
    image_ids: [],
    similarity: 0,
    images: [],
    ...overrides,
  };
}

function tableFact(overrides: Partial<NonNullable<SearchResult["table_facts"]>[number]> = {}) {
  return {
    id: "fact-1",
    document_id: "doc-1",
    source_chunk_id: "chunk-1",
    source_image_id: null,
    page_number: 1,
    table_title: "Medication dose table",
    row_label: "Lorazepam",
    clinical_parameter: "Dose",
    threshold_value: "1 mg IM",
    action: "Review before repeat PRN dose.",
    ...overrides,
  };
}

describe("retrieval query variants", () => {
  it("keeps typo-corrected acronym terms in a capped variant list", () => {
    const analysis = analyzeClinicalQuery("clozapin FBC ANC threshold");
    const variants = buildRetrievalQueryVariants("clozapin FBC ANC threshold", analysis);

    expect(variants[0]).toContain("clozapine");
    expect(variants.join(" ")).toContain("fbc");
    expect(variants.join(" ")).toContain("anc");
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("adds document-title-focused variants for document lookup intent", () => {
    const query = "Where is the active community patients in ED document?";
    const analysis = analyzeClinicalQuery(query);
    const variants = buildRetrievalQueryVariants(query, analysis);

    expect(analysis.documentTitleIntent).toBe(true);
    expect(variants.some((variant) => variant.includes("active community"))).toBe(true);
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("adds shortened core variants for long natural-language threshold questions", () => {
    const query =
      "Please can you tell me exactly when I should withhold clozapine based on ANC and FBC threshold values in the monitoring table?";
    const analysis = analyzeClinicalQuery(query);
    const variants = buildRetrievalQueryVariants(query, analysis);

    expect(variants.length).toBeGreaterThan(1);
    expect(variants.some((variant) => variant.includes("clozapine") && variant.includes("anc"))).toBe(true);
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("adds DB-backed canonical aliases without exceeding the variant cap", () => {
    const query = "What is the depot workflow for missed doses?";
    const analysis = analyzeClinicalQuery(query);
    const aliases = [
      {
        alias: "depot",
        canonical: "long acting injectable antipsychotic",
        alias_type: "clinical_term",
        weight: 2,
        owner_id: null,
      },
    ];
    const variants = buildRetrievalQueryVariants(query, analysis, aliases);

    expect(variants.join(" ")).toContain("long acting injectable antipsychotic");
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("only expands aliases supplied for the current owner scope", () => {
    const query = "clozapin anc threshold";
    const expansions = selectRagAliasExpansions(query, [
      { alias: "clozapin", canonical: "clozapine", alias_type: "typo", owner_id: "owner-a", weight: 1 },
    ]);

    expect(expansions).toEqual(["clozapine"]);
    expect(expansions).not.toContain("private owner b neutrophil threshold");
  });

  it("does not short-circuit unsupported-looking queries when a DB alias matches", () => {
    const query = "coffee machine wobblefix";
    const analysis = analyzeClinicalQuery(query);
    const expansions = selectRagAliasExpansions(query, [
      { alias: "wobblefix", canonical: "clozapine monitoring ANC threshold", alias_type: "custom", weight: 1 },
    ]);

    expect(shouldApplyUnsupportedSearchShortCircuit(query, analysis, [])).toBe(true);
    expect(expansions).toEqual(["clozapine monitoring ANC threshold"]);
    expect(shouldApplyUnsupportedSearchShortCircuit(query, analysis, expansions)).toBe(false);
  });

  it("uses smaller lexical candidate budgets for fast-path-friendly query classes", () => {
    expect(textCandidateBudgetForQueryClass("document_lookup", 12)).toBe(36);
    expect(textCandidateBudgetForQueryClass("table_threshold", 12)).toBe(48);
    expect(textCandidateBudgetForQueryClass("medication_dose_risk", 12)).toBe(48);
    expect(textCandidateBudgetForQueryClass("comparison", 12)).toBe(84);
    expect(textCandidateBudgetForQueryClass("unsupported_or_general", 12)).toBe(24);
  });

  it("allows direct document title hits to skip embedding retrieval", () => {
    expect(
      decideTextFastPath(
        "Where is the patient safety plan document?",
        [
          result({
            title: "Patient Safety Plan",
            similarity: 0.4,
            match_explanation: { titleHit: true, reasons: ["title"] },
          }),
        ],
        "document_lookup",
      ),
    ).toEqual({ returnFastPath: true, reason: "direct_title_text_match" });
  });

  it("keeps table-threshold fast paths gated on structured evidence", () => {
    expect(
      decideTextFastPath(
        "When should clozapine be withheld based on ANC threshold?",
        [result({ content: "Clozapine monitoring overview.", similarity: 0.8 })],
        "table_threshold",
      ),
    ).toEqual({ returnFastPath: false, reason: "missing_structured_threshold_evidence" });

    expect(
      decideTextFastPath(
        "When should clozapine be withheld based on ANC threshold?",
        [
          result({
            content: "Structured threshold table.",
            similarity: 0.66,
            table_facts: [tableFact({ clinical_parameter: "ANC", threshold_value: "< 1.5", action: "Withhold." })],
          }),
        ],
        "table_threshold",
      ),
    ).toEqual({ returnFastPath: false, reason: "threshold_action_requires_structured_retrieval" });

    expect(
      decideTextFastPath(
        "What clozapine ANC monitoring threshold is shown?",
        [
          result({
            content: "Structured threshold table.",
            similarity: 0.66,
            table_facts: [tableFact({ clinical_parameter: "ANC", threshold_value: "< 1.5", action: "Withhold." })],
          }),
        ],
        "table_threshold",
      ),
    ).toEqual({ returnFastPath: true, reason: "structured_threshold_text_match" });
  });

  it("keeps medication-dose fast paths gated on dose evidence", () => {
    expect(
      decideTextFastPath(
        "What dose of lorazepam is recommended?",
        [result({ content: "General agitation pathway.", similarity: 0.9 })],
        "medication_dose_risk",
      ),
    ).toEqual({ returnFastPath: false, reason: "missing_dose_evidence" });

    expect(
      decideTextFastPath(
        "What dose of lorazepam is recommended?",
        [
          result({
            content: "Lorazepam 1 mg IM may be used with monitoring.",
            similarity: 0.67,
          }),
        ],
        "medication_dose_risk",
      ),
    ).toEqual({ returnFastPath: true, reason: "dose_evidence_text_match" });
  });

  it("does not fast-path comparison queries before synthesis retrieval", () => {
    expect(
      decideTextFastPath(
        "Compare clozapine and lithium monitoring requirements.",
        [result({ content: "Clozapine and lithium monitoring.", similarity: 0.95 })],
        "comparison",
      ),
    ).toEqual({ returnFastPath: false, reason: "comparison_requires_synthesis" });
  });

  it("accepts active community ED title evidence before vector retrieval", () => {
    const gate = evaluateEvidenceCoverageGate(
      "How are active community patients in ED managed?",
      [
        result({
          title: "Active Community Patients in the Emergency Department",
          file_name: "active-community-pt-ed.pdf",
          content: "Active community patients in ED require liaison with the community team.",
          similarity: 0.72,
          match_explanation: {
            titleHit: true,
            labelHit: false,
            sectionHit: false,
            contentHit: true,
            tableHit: false,
            reasons: ["title"],
          },
        }),
      ],
      "document_lookup",
    );

    expect(gate).toMatchObject({
      accepted: true,
      reason: "active_community_ed_title_gate",
      strategy: "document_lookup_fast_path",
    });
  });

  it("requires clozapine blood action structured evidence for withhold threshold fast gates", () => {
    const query = "When should clozapine be withheld based on ANC and FBC threshold values?";
    expect(
      evaluateEvidenceCoverageGate(
        query,
        [
          result({
            title: "Clozapine Prescribing Administration Monitoring",
            content: "Clozapine monitoring overview.",
            similarity: 0.9,
          }),
        ],
        "table_threshold",
      ),
    ).toMatchObject({ accepted: false, reason: "missing_clozapine_blood_action_structured_threshold" });

    expect(
      evaluateEvidenceCoverageGate(
        query,
        [
          result({
            title: "Clozapine Prescribing Administration Monitoring",
            content: "ANC and FBC monitoring table.",
            similarity: 0.8,
            table_facts: [
              tableFact({
                table_title: "Clozapine ANC/FBC table",
                clinical_parameter: "ANC",
                threshold_value: "< 1.5",
                action: "Withhold clozapine and review.",
              }),
            ],
          }),
        ],
        "table_threshold",
      ),
    ).toMatchObject({ accepted: true, reason: "clozapine_blood_action_structured_threshold" });
  });

  it("requires both route and numeric dose evidence for dose-route fast gates", () => {
    expect(
      evaluateEvidenceCoverageGate(
        "What dose and route are shown in the agitation medication chart?",
        [result({ title: "Agitation and Arousal", content: "Lorazepam may be used for agitation.", similarity: 0.9 })],
        "medication_dose_risk",
      ),
    ).toMatchObject({ accepted: false, reason: "missing_dose_amount_evidence" });

    expect(
      evaluateEvidenceCoverageGate(
        "What dose and route are shown in the agitation medication chart?",
        [
          result({
            title: "Agitation and Arousal Pharmacological Management",
            content: "Agitation medication chart: lorazepam 1 mg IM or PO with monitoring.",
            similarity: 0.8,
          }),
        ],
        "medication_dose_risk",
      ),
    ).toMatchObject({ accepted: true, reason: "dose_route_amount_evidence_gate" });
  });

  it("requires direct source image evidence for source image/table requests", () => {
    const query = "Show the source table image for the patient property restricted items table.";
    expect(
      evaluateEvidenceCoverageGate(
        query,
        [
          result({
            title: "Patient Property",
            content: "Patient property restricted items table.",
            similarity: 0.8,
            table_facts: [
              tableFact({ source_image_id: null, table_title: "Patient Property", row_label: "Restricted items" }),
            ],
          }),
        ],
        "table_threshold",
      ),
    ).toMatchObject({ accepted: false, reason: "source_image_required_missing" });

    expect(
      evaluateEvidenceCoverageGate(
        query,
        [
          result({
            title: "Patient Property",
            content: "Patient property restricted items table.",
            similarity: 0.8,
            table_facts: [
              tableFact({ source_image_id: "image-1", table_title: "Patient Property", row_label: "Restricted items" }),
            ],
          }),
        ],
        "table_threshold",
      ),
    ).toMatchObject({ accepted: true, sourceImageSatisfied: true });
  });

  it("redacts retrieval cache keys while preserving query class and variant uniqueness", () => {
    const baseArgs = {
      query: "What ANC threshold should stop clozapine?",
      ownerId: "owner-1",
      topK: 8,
      minSimilarity: 0.12,
      queryMode: "auto" as const,
    };
    const key = retrievalPlanCacheQuery(baseArgs, "table_threshold", ["clozapine anc", "clozapine fbc"]);

    expect(key).toMatch(/^redacted-cache:[a-f0-9]{64}$/);
    expect(key).not.toContain("clozapine");
    expect(key).not.toContain("class:table_threshold");
    expect(key).not.toEqual(retrievalPlanCacheQuery(baseArgs, "document_lookup", ["clozapine anc", "clozapine fbc"]));
    expect(key).not.toEqual(retrievalPlanCacheQuery(baseArgs, "table_threshold", ["different variant"]));
    expect(key).not.toEqual(retrievalPlanCacheQuery({ ...baseArgs, topK: 12 }, "table_threshold", ["clozapine anc"]));
  });
});

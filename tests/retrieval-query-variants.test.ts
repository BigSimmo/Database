import { describe, expect, it } from "vitest";
import { analyzeClinicalQuery, buildClinicalTextSearchQuery, rankClinicalResults } from "../src/lib/clinical-search";
import { selectRetrievalEvidence } from "../src/lib/retrieval-selection";
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

  it("keeps flowchart zone-action fast paths gated on action evidence", () => {
    const query = "In the clinical flowchart, what is the next step after red-zone risk?";

    // A lexically strong but action-free flowchart page must not short-circuit
    // retrieval before the structured/vector layers can surface the zone actions.
    expect(
      decideTextFastPath(
        query,
        [
          result({
            content: "Appendix IV: Risk assessment flow chart to identify infection control procedures.",
            similarity: 0.82,
          }),
        ],
        "document_lookup",
      ),
    ).toEqual({ returnFastPath: false, reason: "flowchart_action_requires_structured_retrieval" });

    expect(
      decideTextFastPath(
        query,
        [
          result({
            content:
              "If deteriorating (has any Purple or Red Zone criteria on observation chart), escalate for Senior Clinician Review or call a MET.",
            similarity: 0.82,
          }),
        ],
        "document_lookup",
      ),
    ).toEqual({ returnFastPath: true, reason: "strong_document_text_score" });
  });

  it("requires zone and action evidence on a single result for the flowchart risk gate", () => {
    const query = "In the clinical flowchart, what is the next step after red-zone risk?";

    // Zone words on one result and action words on another (or a flowchart image
    // caption) must not satisfy the gate - the answer needs both on one result.
    expect(
      evaluateEvidenceCoverageGate(
        query,
        [
          result({ content: "Risk assessment flow chart for infection control procedures.", similarity: 0.9 }),
          result({
            id: "chunk-2",
            content: "Compliance is monitored by review of clinical incidents.",
            similarity: 0.8,
          }),
        ],
        "document_lookup",
      ),
    ).toMatchObject({ accepted: false, reason: "missing_visual_flowchart_risk_evidence" });

    expect(
      evaluateEvidenceCoverageGate(
        query,
        [
          result({
            content:
              "If deteriorating (has any Purple or Red Zone criteria on observation chart), escalate for Senior Clinician Review.",
            similarity: 0.9,
          }),
        ],
        "document_lookup",
      ),
    ).toMatchObject({ accepted: true, reason: "visual_flowchart_risk_gate" });
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

  it("keeps source-image table and ANC terms in the text retrieval query", () => {
    const textQuery = buildClinicalTextSearchQuery(
      "Show the source table image for the clozapine ANC monitoring table.",
    );

    expect(textQuery).toContain("source");
    expect(textQuery).toContain("image");
    expect(textQuery).toContain("table");
    expect(textQuery).toContain("clozapine");
    expect(textQuery).toContain("anc");
  });

  it("keeps risk and red-zone flowchart terms in the text retrieval query", () => {
    const query = "In the clinical flowchart, what is the next step after red-zone risk?";
    const textQuery = buildClinicalTextSearchQuery(query);
    const variants = buildRetrievalQueryVariants(query, analyzeClinicalQuery(query));

    expect(textQuery).toContain("risk");
    expect(textQuery).toContain("red");
    expect(textQuery).toContain("flowchart");
    expect(textQuery).toContain("next");
    expect(textQuery).toContain("step");
    // "red zone" replaces the old fully-conjunctive variants ("red zone risk flow",
    // "risk flow review urgent escalation") which matched 0/2 live chunks under
    // websearch_to_tsquery AND semantics and never contributed candidates.
    expect(variants).toEqual(expect.arrayContaining(["risk flow", "red zone"]));
    expect(variants).not.toContain("red zone risk flow");
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("keeps agitation route queries focused on the canonical agitation and arousal source", () => {
    const query = "What IM or PO options are listed for agitation?";
    const textQuery = buildClinicalTextSearchQuery(query);
    const ranked = rankClinicalResults(query, [
      result({
        id: "generic-icu",
        document_id: "generic-doc",
        title: "Ventilated ICU Patients Bundle",
        file_name: "Ventilated ICU Patients Bundle.pdf",
        content: "Fentanyl bolus 50 microg/hr and oral medication options are listed.",
        similarity: 0.88,
      }),
      result({
        id: "agitation-source",
        document_id: "agitation-doc",
        title: "Agitation and Arousal Pharmacological Management",
        file_name: "MHSP.AgitationArousalPharmaMgt.pdf",
        content: "Agitation medication chart: lorazepam 1 mg IM or PO with monitoring.",
        similarity: 0.54,
      }),
    ]);
    const selected = selectRetrievalEvidence({
      query,
      queryClass: "medication_dose_risk",
      results: ranked,
      topK: 1,
      maxResultsPerDocument: 2,
    });

    expect(textQuery).toContain("arousal");
    expect(textQuery).toContain("pharmacological");
    expect(textQuery).toContain("im");
    expect(textQuery).toContain("po");
    expect(ranked[0].file_name).toBe("MHSP.AgitationArousalPharmaMgt.pdf");
    expect(selected.results[0]?.file_name).toBe("MHSP.AgitationArousalPharmaMgt.pdf");
  });

  it("keeps typo-heavy agitation dosing queries above generic infusion dosing sources", () => {
    const query = "What agitaton and arousl dosing guidance applies to psychiatric inpatients?";
    const textQuery = buildClinicalTextSearchQuery(query);
    const ranked = rankClinicalResults(query, [
      result({
        id: "smart-pump",
        document_id: "smart-pump-doc",
        title: "Smart Infusion Pumps and Dose Error Reduction Software Policy",
        file_name: "Smart Infusion Pumps and Dose Error Reduction Software (DERS) Policy (RPBG).pdf",
        content: "Infusion pump dose limits, infusion medication safety, and inpatient medication guidance.",
        similarity: 0.91,
      }),
      result({
        id: "dopamine",
        document_id: "dopamine-doc",
        title: "Dopamine Intravenous Infusion Management",
        file_name: "Dopamine Intravenous Infusion Management (RPBG).pdf",
        content: "Dopamine intravenous infusion dosing and monitoring guidance for clinical deterioration.",
        similarity: 0.87,
      }),
      result({
        id: "agitation-source",
        document_id: "agitation-doc",
        title: "Agitation and Arousal Pharmacological Management",
        file_name: "MHSP.AgitationArousalPharmaMgt.pdf",
        content:
          "Medication chart for agitation and arousal pharmacological management in psychiatric inpatients, including IM and PO dose options.",
        similarity: 0.55,
        table_facts: [
          tableFact({
            table_title: "Agitation and arousal medication chart",
            row_label: "Lorazepam",
            threshold_value: "1 mg IM or PO",
            action: "Monitor response before repeat dosing.",
          }),
        ],
      }),
    ]);
    const selected = selectRetrievalEvidence({
      query,
      queryClass: "medication_dose_risk",
      results: ranked,
      topK: 1,
      maxResultsPerDocument: 2,
    });

    expect(textQuery).toBe("agitation arousal pharmacological management medication chart dose route im po");
    expect(ranked[0].file_name).toBe("MHSP.AgitationArousalPharmaMgt.pdf");
    expect(selected.results[0]?.file_name).toBe("MHSP.AgitationArousalPharmaMgt.pdf");
  });

  it("promotes active-community ED source identity over generic ED management documents", () => {
    const query = "How are active community patients in ED managed?";
    const ranked = rankClinicalResults(query, [
      result({
        id: "generic-ed",
        document_id: "generic-ed-doc",
        title: "Patient Management in ED",
        file_name: "Patient Management in ED (FSH).pdf",
        content: "Management plan in ED and consultation liaison review.",
        similarity: 0.88,
      }),
      result({
        id: "active-community",
        document_id: "active-community-doc",
        title: "Active Community Pt ED",
        file_name: "MHSP.ActiveCommunityPtED.pdf",
        content: "Active community patients in ED are managed with community team liaison.",
        similarity: 0.52,
      }),
    ]);
    const selected = selectRetrievalEvidence({
      query,
      queryClass: "document_lookup",
      results: ranked,
      topK: 1,
      maxResultsPerDocument: 2,
    });

    expect(ranked[0].file_name).toBe("MHSP.ActiveCommunityPtED.pdf");
    expect(selected.results[0]?.file_name).toBe("MHSP.ActiveCommunityPtED.pdf");
  });

  it("promotes red-zone risk flowchart evidence over generic red-flag deterioration documents", () => {
    const query = "In the clinical flowchart, what is the next step after red-zone risk?";
    const ranked = rankClinicalResults(query, [
      result({
        id: "generic-red-flags",
        document_id: "generic-red-flags-doc",
        title: "Secondary Assessment of Undiagnosed Patient in ED",
        file_name: "Secondary Assessment of Undiagnosed Patient in ED.pdf",
        content: "Identify red flags and escalate deterioration concerns.",
        similarity: 0.82,
      }),
      result({
        id: "risk-flowchart",
        document_id: "risk-flowchart-doc",
        title: "Risk Flowchart Red Zone",
        file_name: "Clinical Risk Flowchart.pdf",
        content: "Risk flowchart: after red-zone risk, urgent senior review is the next step.",
        similarity: 0.51,
      }),
    ]);
    const selected = selectRetrievalEvidence({
      query,
      queryClass: "document_lookup",
      results: ranked,
      topK: 1,
      maxResultsPerDocument: 2,
    });

    expect(ranked[0].file_name).toBe("Clinical Risk Flowchart.pdf");
    expect(selected.results[0]?.file_name).toBe("Clinical Risk Flowchart.pdf");
  });

  it("treats zone-action escalation text as risk-flowchart evidence even without the word flowchart", () => {
    const query = "In the clinical flowchart, what is the next step after red-zone risk?";
    const ranked = rankClinicalResults(query, [
      result({
        id: "zone-action",
        document_id: "zone-action-doc",
        title: "Recognising and Responding to Acute Deterioration",
        file_name: "Recognising and Responding to Acute Deterioration.pdf",
        content:
          "If deteriorating (has any Purple or Red Zone criteria on observation chart), escalate for Senior Clinician Review or call a MET.",
        similarity: 0.62,
      }),
    ]);

    // Escalation protocols express the flowchart's decision steps as text; they
    // must not take the generic risk-flowchart penalty for lacking the literal
    // word "flowchart".
    expect(ranked[0]?.score_explanation?.rawPenalty).toBe(0);
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

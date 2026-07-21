import { describe, expect, it } from "vitest";

import {
  chooseValidatedExtractiveShortCircuit,
  hasValidatedRoutineProceduralExtractiveAnswer,
  routineProceduralContentPattern,
} from "../src/lib/rag/rag-extractive-first";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "procedural-chunk-1",
    document_id: "procedural-doc",
    title: "Consumer Crisis Response Guideline",
    file_name: "consumer-crisis-response.pdf",
    page_number: 4,
    chunk_index: 0,
    section_heading: "Safety planning for identified risks",
    content:
      "The Consumer Safety Plan must be developed in collaboration with the consumer, involve carers and family where appropriate, identify actions for a crisis and who is responsible, and be reviewed when clinical status changes.",
    image_ids: [],
    similarity: 0.9,
    hybrid_score: 0.9,
    text_rank: 0.11,
    source_metadata: {
      source_title: "Crisis response source",
      publisher: "Local service",
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
    },
    images: [],
    ...overrides,
  };
}

const proceduralQuery = "What should a patient safety plan include?";

function proceduralArgs(overrides: Partial<Parameters<typeof chooseValidatedExtractiveShortCircuit>[0]> = {}) {
  return {
    query: proceduralQuery,
    queryClass: "document_lookup" as const,
    results: [source()],
    route: { mode: "fast" as const, reason: "strong_routine_retrieval" },
    sourceBacked: true,
    gateStatus: "passed" as const,
    ...overrides,
  };
}

describe("routineProceduralContentPattern", () => {
  it("matches 'What …' questions that ask about process, inclusion, or requirements", () => {
    expect(routineProceduralContentPattern.test("What should a patient safety plan include?")).toBe(true);
    expect(routineProceduralContentPattern.test("what steps are required for seclusion documentation")).toBe(true);
    expect(routineProceduralContentPattern.test("  What is the admission procedure?")).toBe(true);
    expect(routineProceduralContentPattern.test("What does the transfer process involve?")).toBe(true);
  });

  it("deliberately excludes 'How is X handled/managed?' shapes and non-procedural questions", () => {
    expect(routineProceduralContentPattern.test("How is patient safety planning handled?")).toBe(false);
    expect(routineProceduralContentPattern.test("How are long acting injectables managed?")).toBe(false);
    expect(routineProceduralContentPattern.test("What is clozapine?")).toBe(false);
    expect(routineProceduralContentPattern.test("Describe the discharge process")).toBe(false);
    expect(routineProceduralContentPattern.test("Somewhat unclear process question")).toBe(false);
  });
});

describe("hasValidatedRoutineProceduralExtractiveAnswer", () => {
  it("accepts the gate-passed strong routine procedural shape whose candidate validates", () => {
    expect(hasValidatedRoutineProceduralExtractiveAnswer(proceduralArgs())).toBe(true);
  });

  it("accepts the unsupported_or_general query class alongside document_lookup", () => {
    expect(
      hasValidatedRoutineProceduralExtractiveAnswer(proceduralArgs({ queryClass: "unsupported_or_general" })),
    ).toBe(true);
  });

  it("refuses every off-shape input", () => {
    expect(
      hasValidatedRoutineProceduralExtractiveAnswer(
        proceduralArgs({ route: { mode: "fast", reason: "clinical_fast_grounded_synthesis" } }),
      ),
    ).toBe(false);
    expect(
      hasValidatedRoutineProceduralExtractiveAnswer(
        proceduralArgs({ route: { mode: "strong", reason: "strong_routine_retrieval" } }),
      ),
    ).toBe(false);
    expect(hasValidatedRoutineProceduralExtractiveAnswer(proceduralArgs({ gateStatus: "blocked" }))).toBe(false);
    expect(hasValidatedRoutineProceduralExtractiveAnswer(proceduralArgs({ sourceBacked: false }))).toBe(false);
    expect(hasValidatedRoutineProceduralExtractiveAnswer(proceduralArgs({ queryClass: "medication_dose_risk" }))).toBe(
      false,
    );
    expect(hasValidatedRoutineProceduralExtractiveAnswer(proceduralArgs({ results: [] }))).toBe(false);
    expect(
      hasValidatedRoutineProceduralExtractiveAnswer(
        proceduralArgs({ query: "How is patient safety planning handled?" }),
      ),
    ).toBe(false);
  });

  it("refuses when the only extractive candidate is a bare cross-reference that fails the final gates", () => {
    const crossReferenceOnly = [
      source({
        id: "procedural-cross-reference",
        section_heading: "Related procedures",
        content:
          "Refer to the Women's and Perinatal Mental Health Referral and Management Guideline for further information about related procedures.",
      }),
    ];
    expect(hasValidatedRoutineProceduralExtractiveAnswer(proceduralArgs({ results: crossReferenceOnly }))).toBe(false);
  });
});

describe("chooseValidatedExtractiveShortCircuit", () => {
  it("returns the generic LAI marker first for the gate-passed LAI-management shape", () => {
    const laiResults = [
      source({
        id: "lai-management-1",
        document_id: "lai-doc",
        title: "Long Acting Injectable Medication",
        file_name: "MHSP.LongActingInjectable.pdf",
        section_heading: "Management process",
        content:
          "Long acting injectables are managed through a documented medication pathway covering prescribing, administration, observation, follow-up, and clinical review.",
        match_explanation: { titleHit: true, contentHit: true, reasons: ["title", "content"] },
      }),
      source({
        id: "lai-management-2",
        document_id: "lai-doc",
        title: "Long Acting Injectable Medication",
        file_name: "MHSP.LongActingInjectable.pdf",
        section_heading: "Follow-up",
        content:
          "The long acting injectable medication record documents the prescription and administration, with follow-up and review arranged through the treating team.",
        match_explanation: { titleHit: true, contentHit: true, reasons: ["title", "content"] },
      }),
    ];
    const args = proceduralArgs({
      query: "How are long acting injectables managed?",
      queryClass: "medication_dose_risk",
      results: laiResults,
      route: { mode: "fast", reason: "clinical_fast_grounded_synthesis" },
    });

    expect(chooseValidatedExtractiveShortCircuit(args)).toEqual({
      reasonMarker: "validated_generic_lai_management_extractive_answer",
    });
    // The LAI skip is only offered while the retrieval gate passed.
    expect(chooseValidatedExtractiveShortCircuit({ ...args, gateStatus: "blocked" })).toBeNull();
  });

  it("returns the blocked-recovery marker for the score-blocked routine document lookup", () => {
    expect(chooseValidatedExtractiveShortCircuit(proceduralArgs({ gateStatus: "blocked" }))).toEqual({
      reasonMarker: "validated_routine_extractive_recovery",
    });
  });

  it("returns the procedural-first marker for the gate-passed routine procedural shape", () => {
    expect(chooseValidatedExtractiveShortCircuit(proceduralArgs())).toEqual({
      reasonMarker: "validated_routine_extractive_first",
    });
  });

  it("returns null when no validated short-circuit applies", () => {
    expect(
      chooseValidatedExtractiveShortCircuit(proceduralArgs({ query: "How is patient safety planning handled?" })),
    ).toBeNull();
    expect(
      chooseValidatedExtractiveShortCircuit(
        proceduralArgs({ route: { mode: "strong", reason: "limited_retrieval_strength" } }),
      ),
    ).toBeNull();
    expect(chooseValidatedExtractiveShortCircuit(proceduralArgs({ sourceBacked: false }))).toBeNull();
  });
});

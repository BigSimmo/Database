import { describe, expect, it } from "vitest";

import { buildAdmissionDischargeComparisonAnswer } from "../src/lib/rag/rag-extractive-answer";
import type { SearchResult } from "../src/lib/types";

// #019 reproducer — "Admission doc dropped after deterministic comparison packing".
//
// Root cause (traced on current main, src/lib/rag/rag-extractive-answer.ts):
//   query "Compare admission and discharge requirements" is in the source-bound
//   allowlist, so buildFactSynthesizedAnswer (:2315) calls
//   buildAdmissionDischargeComparisonAnswer. That builder requires ONE bound
//   requirement fact per side via sourceBoundComparisonFacts (:2180), where a
//   side only binds if the retrieved chunk's sentence matches one of the NARROW
//   admissionRequirementBindingPatterns (:1050) / dischargeRequirementBindingPatterns
//   (:1068). If retrieval surfaces the correct admission document but the specific
//   chunk's requirement prose is phrased outside those regexes, admissionFacts is
//   empty, `pair` is null, and the builder returns null (:2253). buildFactSynthesizedAnswer
//   then returns the gap answer with `citationChunkIds: []` (:2320) — so the
//   retrieved admission source is dropped from the answer even though retrieval
//   surfaced it. This is answer-layer, not retrieval/ranking: retrieval stays 36/36.
//
// This is a reproducer only. The fix is a protected-surface behaviour change and
// requires a live eval-canary pair before it is trusted (see docs/rag-behaviour/),
// so no behaviour is changed here.

const ADMISSION_FILE = "Admission of Community Patients (AKG).pdf";
const DISCHARGE_FILE = "Discharge Planning for Community Patients (NMHS).pdf";

// A discharge chunk whose sentence DOES match dischargeRequirementBindingPatterns[0].
const DISCHARGE_BOUND_SENTENCE =
  "Clinicians must actively plan the effective and timely discharge of every community patient.";

// Real admission-requirement prose that does NOT match any admissionRequirementBindingPattern
// (no "medical clearance", "prioritisation of beds", "high observation beds", etc.).
const ADMISSION_UNBOUND_SENTENCE =
  "On admission, the treating team must complete a mental state examination and confirm an available bed before the consumer is formally accepted to the unit.";

// An admission chunk whose sentence DOES match admissionRequirementBindingPatterns
// (the "medical clearance must be obtained" binder). Same document, only the prose differs.
const ADMISSION_BOUND_SENTENCE = "Medical clearance must be obtained before the admission of any community patient.";

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

const dischargeResult = result({
  id: "discharge-chunk",
  document_id: "discharge-community-doc",
  title: "Discharge Planning for Community Patients",
  file_name: DISCHARGE_FILE,
  content: DISCHARGE_BOUND_SENTENCE,
});

const QUERY = "Compare admission and discharge requirements";

describe("#019 admission source dropped in comparison fallback", () => {
  it("drops the retrieved admission source when its chunk prose falls outside the narrow binders (current buggy behaviour)", () => {
    const admissionRetrievedButUnbound = result({
      id: "admission-chunk",
      document_id: "admission-community-doc",
      title: "Admission of Community Patients",
      file_name: ADMISSION_FILE,
      content: ADMISSION_UNBOUND_SENTENCE,
    });

    // Both expected sources are present in the (healthy) retrieval set, distinct documents.
    const answer = buildAdmissionDischargeComparisonAnswer({
      query: QUERY,
      results: [admissionRetrievedButUnbound, dischargeResult],
    });

    // BUG: the builder returns null, so the caller emits an empty-citation gap answer
    // and the admission source is dropped from the answer. Characterises #019 on current main.
    expect(answer).toBeNull();
  });

  it("retains both sources when the admission chunk prose DOES match a binder (control — proves the binder is the discriminator)", () => {
    const admissionBound = result({
      id: "admission-chunk",
      document_id: "admission-community-doc",
      title: "Admission of Community Patients",
      file_name: ADMISSION_FILE,
      content: ADMISSION_BOUND_SENTENCE,
    });

    const answer = buildAdmissionDischargeComparisonAnswer({
      query: QUERY,
      results: [admissionBound, dischargeResult],
    });

    expect(answer).not.toBeNull();
    // Both retrieved sources are cited only when the admission prose happens to match a binder.
    expect(answer?.citationChunkIds).toEqual(expect.arrayContaining(["admission-chunk", "discharge-chunk"]));
  });

  // RED spec — the contract #019 must satisfy. Skipped so CI stays green; enable it as the
  // acceptance test alongside the (canary-gated) fix. It fails on current main because the
  // admission source is dropped whenever its retrieved prose is outside the narrow binders.
  it.skip("(RED #019) retains a retrieved admission source regardless of its exact requirement phrasing", () => {
    const admissionRetrievedButUnbound = result({
      id: "admission-chunk",
      document_id: "admission-community-doc",
      title: "Admission of Community Patients",
      file_name: ADMISSION_FILE,
      content: ADMISSION_UNBOUND_SENTENCE,
    });

    const answer = buildAdmissionDischargeComparisonAnswer({
      query: QUERY,
      results: [admissionRetrievedButUnbound, dischargeResult],
    });

    expect(answer).not.toBeNull();
    expect(answer?.citationChunkIds).toEqual(expect.arrayContaining(["admission-chunk", "discharge-chunk"]));
  });
});

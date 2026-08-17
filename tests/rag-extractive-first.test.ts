import { describe, expect, it } from "vitest";

import {
  chooseValidatedExtractiveShortCircuit,
  hasValidatedActiveCommunityEdProcedureExtractiveAnswer,
  hasValidatedAgitationArousalTypoDosingExtractiveAnswer,
  hasValidatedAdmissionDischargeComparisonExtractiveAnswer,
  hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer,
  hasValidatedClozapineBloodActionThresholdExtractiveAnswer,
  hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer,
  hasValidatedExtractiveCandidate,
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
  const admissionDischargeResults = [
    source({
      id: "admission-clearance",
      document_id: "admission-doc",
      title: "Admission Of Community Patients",
      file_name: "MHSP.AdmissionCommunityPts.pdf",
      content:
        "Where there are physical health concerns, the referring clinician will provide medical clearance before transfer.",
    }),
    source({
      id: "discharge-planning",
      document_id: "discharge-doc",
      title: "Discharge Planning For Community Patients",
      file_name: "MHSP.Discharge.pdf",
      content: "Discharge planning must include documented ongoing care arrangements.",
    }),
  ];

  const activeCommunityEdResults = [
    source({
      id: "active-community-ed-process",
      document_id: "active-community-ed-doc",
      title: "Active Community Patients In The Emergency Department(AKG)",
      file_name: "Active Community Patients in the Emergency Department (AKG).pdf",
      page_number: 1,
      section_heading: null,
      content: `3.1 Process
• The consumer will be triaged by the Triage Nurse at the AHS ED and the ED Mental Health
Liaison Nurse (EDMHLN) will provide a mental health assessment as required.
• If the consumer is referred to the EDMHLN for assessment, the EDMHLN will identify via
PSOLIS, whether they are active with any AMHS community mental health team, i.e.
Assessment and Treatment Team (ATT), Clinical Treatment Team (CTT) inclusive of the
Individual Community Living Support (ICLS) and Early Episode Psychosis Team (EEPT), and
Older Adult Mental Health Service (OAMHS) or EMHS Crisis Resolution Home Treatment
Team (CRHTT).
• The EDMHLN will check PSOLIS for a Treatment Support Discharge Plan (TSD) /crisis plan
to ascertain care and treatment being provided in community.
• The EDMHLN will contact the relevant community mental health team, EMHS CRHTT team
to inform the Care Coordinator or Allocated Clinician that the consumer has presented to ED
and to request collateral information.`,
    }),
    source({
      id: "active-community-ed-access",
      document_id: "active-community-ed-doc",
      title: "Active Community Patients In The Emergency Department(AKG)",
      file_name: "Active Community Patients in the Emergency Department (AKG).pdf",
      page_number: 1,
      section_heading: "AK 0004/18",
      content: `2. Purpose
All consumers active with Armadale Mental Health Service (AMHS) are assessed by the most
appropriate mental health clinician available

Consumers should be routinely provided with information on how to access their relevant
treating team during office hours and be provided with information regarding out of hours
emergency contacts. All consumers should be encouraged to utilise these contacts.`,
    }),
  ];

  const clozapineRedRangeResults = [
    source({
      id: "nmhs-clozapine-red-range",
      document_id: "nmhs-clozapine",
      title: "Clozapine Prescribing(NMHS)",
      file_name: "Clozapine Prescribing (NMHS).pdf",
      page_number: 7,
      section_heading: "8.2 Monitoring for agranulocytosis and neutropenia",
      content: `Clozapine Blood Results Monitoring Recommended Action
System
WBC ≥ 3.5 x 109/L AND Continue clozapine therapy
Green Range Neutrophils ≥ 2.0 x 109 /L
WBC 3.0 - <3.5 x 109/L AND/OR Continue clozapine therapy with twice-weekly blood
Amber Range Neutrophils 1.5 - < 2.0 x 109 /L tests until return to “green” range
WBC < 3.0 x 109/L AND/OR Stop clozapine therapy immediately.
Red Range Neutrophils < 1.5 x 109 /L Contact haematologist and Clozapine Monitoring
Centre`,
    }),
  ];

  const communityHomeVisitResults = [
    source({
      id: "community-home-visit-departure",
      document_id: "community-home-visit-akg",
      title: "Community Home Visit(AKG)",
      file_name: "Community Home Visit (AKG).pdf",
      page_number: 1,
      section_heading: "Procedure",
      content: `All clinical staff are to complete a Community Home Visit Log prior to leaving the workplace.
Designated OAC clerical staff will review the log.`,
    }),
    source({
      id: "community-home-visit-return",
      document_id: "community-home-visit-akg",
      title: "Community Home Visit(AKG)",
      file_name: "Community Home Visit (AKG).pdf",
      page_number: 2,
      section_heading: "Safety monitoring",
      content: `Leschen clerical reception staff will take responsibility for safety monitoring.
The clinician will inform Leschen clerical reception staff on their return to the workplace and update the community home visit log.`,
    }),
  ];

  const bestPracticePrescriptionResults = [
    source({
      id: "best-practice-program-use",
      document_id: "best-practice-prescription-akg",
      title: "Best Practice Prescription(AKG)",
      file_name: "Best Practice Prescription (AKG).pdf",
      page_number: 1,
      section_heading: "MEN-PRO-0489-19",
      content: `Best Practice Prescription Program is an electronic program implemented in the AHS outpatient mental health clinics that is used for the following activities:
• Prescription generation (replacing handwritten prescriptions)
• Maintenance of electronic medication profiles (replacing paper-based profiles)
• Internal and external correspondence generation
• Recording other relevant clinical information (e.g.: allergies/ adverse drug reactions).`,
    }),
    source({
      id: "best-practice-profile-maintenance",
      document_id: "best-practice-prescription-akg",
      title: "Best Practice Prescription(AKG)",
      file_name: "Best Practice Prescription (AKG).pdf",
      page_number: 2,
      section_heading: "Maintaining a medication profile",
      content: `At the first clinic appointment, medical officers are to inquire with the consumer (or carer) about their current medications and may need to verify this information with the consumer's own medications or a suitable alternative source (e.g.: General Practitioner).
The details (i.e.: medication name, formulation, route, dose and directions for use) of each psychiatric and non-psychiatric medication must be entered into the Best Practice Prescription Program medication profile.`,
    }),
  ];

  it("short-circuits only the validated two-document admission/discharge comparison", () => {
    const args = proceduralArgs({
      query: "Compare admission and discharge requirements",
      queryClass: "comparison",
      results: admissionDischargeResults,
      route: { mode: "strong", reason: "multi_document_comparison_synthesis" },
    });

    expect(hasValidatedAdmissionDischargeComparisonExtractiveAnswer(args)).toBe(true);
    expect(chooseValidatedExtractiveShortCircuit(args)).toEqual({
      reasonMarker: "validated_admission_discharge_extractive_first",
    });

    const paraphraseArgs = {
      ...args,
      query: "Combine community admission steps with discharge documentation requirements.",
    };
    expect(hasValidatedAdmissionDischargeComparisonExtractiveAnswer(paraphraseArgs)).toBe(true);
    expect(chooseValidatedExtractiveShortCircuit(paraphraseArgs)).toEqual({
      reasonMarker: "validated_admission_discharge_extractive_first",
    });
  });

  it("does not short-circuit a one-document, blocked, or generic comparison", () => {
    const args = proceduralArgs({
      query: "Compare admission and discharge requirements",
      queryClass: "comparison",
      results: admissionDischargeResults,
      route: { mode: "strong", reason: "multi_document_comparison_synthesis" },
    });

    expect(
      hasValidatedAdmissionDischargeComparisonExtractiveAnswer({
        ...args,
        results: admissionDischargeResults.map((result) => ({ ...result, document_id: "combined-doc" })),
      }),
    ).toBe(false);
    expect(hasValidatedAdmissionDischargeComparisonExtractiveAnswer({ ...args, gateStatus: "blocked" })).toBe(false);
    expect(
      hasValidatedAdmissionDischargeComparisonExtractiveAnswer({
        ...args,
        query: "Compare the monitoring requirements in Protocol A and Protocol B",
      }),
    ).toBe(false);
    expect(
      hasValidatedAdmissionDischargeComparisonExtractiveAnswer({
        ...args,
        query: "Compare admission and discharge requirements for medication reconciliation",
      }),
    ).toBe(false);
    expect(
      hasValidatedAdmissionDischargeComparisonExtractiveAnswer({
        ...args,
        query: "Compare admission and discharge requirements that do not involve medical clearance or care planning",
      }),
    ).toBe(false);
  });

  it("short-circuits the measured active-community ED procedure only after same-document validation", () => {
    const args = proceduralArgs({
      query: "How are active community patients in ED managed?",
      queryClass: "document_lookup",
      results: activeCommunityEdResults,
    });

    expect(hasValidatedActiveCommunityEdProcedureExtractiveAnswer(args)).toBe(true);
    expect(chooseValidatedExtractiveShortCircuit(args)).toEqual({
      reasonMarker: "validated_active_community_ed_extractive_first",
    });

    expect(
      hasValidatedActiveCommunityEdProcedureExtractiveAnswer({
        ...args,
        results: activeCommunityEdResults.map((result, index) =>
          index === 1 ? { ...result, document_id: "different-procedure" } : result,
        ),
      }),
    ).toBe(false);
    expect(
      hasValidatedActiveCommunityEdProcedureExtractiveAnswer({
        ...args,
        results: activeCommunityEdResults.map((result, index) =>
          index === 0
            ? { ...result, content: result.content.replace("request collateral information", "file a note") }
            : result,
        ),
      }),
    ).toBe(false);
    expect(hasValidatedActiveCommunityEdProcedureExtractiveAnswer({ ...args, gateStatus: "blocked" })).toBe(false);
    expect(
      hasValidatedActiveCommunityEdProcedureExtractiveAnswer({
        ...args,
        query: "How are eating-disorder patients managed in ED?",
      }),
    ).toBe(false);
  });

  it("short-circuits the measured community-home-visit requirements only from the complete AKG pair", () => {
    const args = proceduralArgs({
      query: "What is required for community home visits?",
      queryClass: "unsupported_or_general",
      results: communityHomeVisitResults,
    });

    expect(hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer(args)).toBe(true);
    expect(chooseValidatedExtractiveShortCircuit(args)).toEqual({
      reasonMarker: "validated_community_home_visit_requirements_extractive_first",
    });
    expect(hasValidatedRoutineProceduralExtractiveAnswer(args)).toBe(false);

    expect(
      hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer({
        ...args,
        results: communityHomeVisitResults.map((result, index) =>
          index === 1 ? { ...result, document_id: "different-procedure" } : result,
        ),
      }),
    ).toBe(false);
    expect(
      hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer({
        ...args,
        results: communityHomeVisitResults.map((result, index) =>
          index === 0 ? { ...result, content: result.content.replace("review the log", "archive the log") } : result,
        ),
      }),
    ).toBe(false);
    expect(
      hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer({
        ...args,
        results: communityHomeVisitResults.map((result) => ({
          ...result,
          title: "Community Visits",
          file_name: "visits.pdf",
        })),
      }),
    ).toBe(false);
    expect(hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer({ ...args, gateStatus: "blocked" })).toBe(false);
    expect(hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer({ ...args, sourceBacked: false })).toBe(false);
    expect(
      hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer({
        ...args,
        query: "What is required for school home visits?",
      }),
    ).toBe(false);
  });

  it("short-circuits the measured Best Practice Prescription query only from the complete AKG pair", () => {
    const args = proceduralArgs({
      query: "What does the best practice prescription document require?",
      queryClass: "document_lookup",
      results: bestPracticePrescriptionResults,
    });

    expect(hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer(args)).toBe(true);
    expect(chooseValidatedExtractiveShortCircuit(args)).toEqual({
      reasonMarker: "validated_best_practice_prescription_requirements_extractive_first",
    });
    expect(hasValidatedRoutineProceduralExtractiveAnswer(args)).toBe(false);

    expect(
      hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer({
        ...args,
        results: bestPracticePrescriptionResults.map((result, index) =>
          index === 1 ? { ...result, document_id: "different-procedure" } : result,
        ),
      }),
    ).toBe(false);
    expect(
      hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer({
        ...args,
        results: bestPracticePrescriptionResults.map((result, index) =>
          index === 1
            ? { ...result, content: result.content.replace("verify this information", "file this information") }
            : result,
        ),
      }),
    ).toBe(false);
    expect(
      hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer({
        ...args,
        results: bestPracticePrescriptionResults.map((result) => ({
          ...result,
          title: "Prescribing overview",
          file_name: "prescribing-overview.pdf",
        })),
      }),
    ).toBe(false);
    expect(hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer({ ...args, gateStatus: "blocked" })).toBe(
      false,
    );
    expect(
      hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer({
        ...args,
        query: "What does the community prescribing document require?",
      }),
    ).toBe(false);
  });

  it("short-circuits the clozapine stop threshold only from one complete reviewed row", () => {
    const args = proceduralArgs({
      query: "What FBC threshold should withhold clozapine?",
      queryClass: "table_threshold",
      results: clozapineRedRangeResults,
      route: { mode: "strong", reason: "clinical_risk_or_complex_query" },
    });

    expect(hasValidatedClozapineBloodActionThresholdExtractiveAnswer(args)).toBe(true);
    expect(chooseValidatedExtractiveShortCircuit(args)).toEqual({
      reasonMarker: "validated_clozapine_blood_threshold_extractive_first",
    });

    const partialRows = [
      { ...clozapineRedRangeResults[0], id: "wbc-only", content: "WBC <3.0 x 109/L: stop clozapine." },
      {
        ...clozapineRedRangeResults[0],
        id: "anc-only",
        document_id: "different-document",
        content: "Red Range Neutrophils <1.5 x 109/L: contact haematology.",
      },
    ];
    expect(hasValidatedClozapineBloodActionThresholdExtractiveAnswer({ ...args, results: partialRows })).toBe(false);
    expect(hasValidatedClozapineBloodActionThresholdExtractiveAnswer({ ...args, gateStatus: "blocked" })).toBe(false);
    expect(hasValidatedClozapineBloodActionThresholdExtractiveAnswer({ ...args, sourceBacked: false })).toBe(false);
    expect(
      hasValidatedClozapineBloodActionThresholdExtractiveAnswer({
        ...args,
        route: { mode: "fast", reason: "clinical_fast_grounded_synthesis" },
      }),
    ).toBe(false);
    expect(
      hasValidatedClozapineBloodActionThresholdExtractiveAnswer({
        ...args,
        query: "What lithium level should prompt withholding?",
      }),
    ).toBe(false);
  });

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
      route: { mode: "strong", reason: "medication_dose_risk_strong_route" },
    });

    expect(chooseValidatedExtractiveShortCircuit(args)).toEqual({
      reasonMarker: "validated_generic_lai_management_extractive_answer",
    });
    // The LAI skip is only offered while the retrieval gate passed.
    expect(chooseValidatedExtractiveShortCircuit({ ...args, gateStatus: "blocked" })).toBeNull();
    // The dosing class no longer reaches the fast fallthrough; the retired fast
    // signature must not qualify.
    expect(
      chooseValidatedExtractiveShortCircuit({
        ...args,
        route: { mode: "fast", reason: "clinical_fast_grounded_synthesis" },
      }),
    ).toBeNull();
  });

  it("short-circuits only the measured typo dosing query when its single-source candidate validates", () => {
    const query = "What agitaton and arousl dosing guidance applies to psychiatric inpatients?";
    const args = proceduralArgs({
      query,
      queryClass: "medication_dose_risk",
      route: { mode: "strong", reason: "medication_dose_risk_strong_route" },
      results: [
        source({
          id: "agitation-repeat-dose-guidance",
          document_id: "agitation-guideline",
          title: "Mental Health Pharmacological Management Of Agitation And Arousal Guideline",
          file_name: "Mental Health Pharmacological Management of Agitation and Arousal Guideline.pdf",
          section_heading: "Repeating doses",
          content:
            "Agitation and arousal scores must be documented before each PRN dose. A total of 3 olanzapine IM doses or 30 mg maximum may be given in 24 hours.",
        }),
      ],
    });

    expect(hasValidatedAgitationArousalTypoDosingExtractiveAnswer(args)).toBe(true);
    expect(chooseValidatedExtractiveShortCircuit(args)).toEqual({
      reasonMarker: "validated_agitation_arousal_typo_dosing_extractive_first",
      resultIds: ["agitation-repeat-dose-guidance"],
    });
    expect(
      hasValidatedAgitationArousalTypoDosingExtractiveAnswer({
        ...args,
        query: "What agitation and arousal dosing guidance applies to psychiatric inpatients?",
      }),
    ).toBe(false);
    expect(hasValidatedAgitationArousalTypoDosingExtractiveAnswer({ ...args, gateStatus: "blocked" })).toBe(false);
    expect(hasValidatedAgitationArousalTypoDosingExtractiveAnswer({ ...args, sourceBacked: false })).toBe(false);
    expect(
      hasValidatedAgitationArousalTypoDosingExtractiveAnswer({
        ...args,
        route: { mode: "fast", reason: "clinical_fast_grounded_synthesis" },
      }),
    ).toBe(false);
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

describe("cross-reference hardening (governance P2)", () => {
  it("rejects a candidate whose lead is a query-overlapping bare cross-reference", () => {
    const results = [
      source({
        content:
          "Refer to the Patient Safety Planning Procedure for further information about what a patient safety plan should include.",
      }),
    ];
    expect(
      hasValidatedExtractiveCandidate({
        query: "What should a patient safety plan include?",
        queryClass: "document_lookup",
        results,
        routeReason: "strong_routine_retrieval",
      }),
    ).toBe(false);
  });
});

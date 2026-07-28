import { describe, expect, it } from "vitest";

import { applyNumericVerification } from "@/lib/answer-verification";
import { assessAndEnforceClaimSupport, assessClaimSupport } from "@/lib/rag/rag-claim-support";
import type { Citation, RagAnswer, SearchResult } from "@/lib/types";

function source(id: string, content: string, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    document_id: `doc-${id}`,
    title: `Source ${id}`,
    file_name: `${id}.pdf`,
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content,
    image_ids: [],
    images: [],
    similarity: 0.9,
    source_metadata: {
      source_title: `Source ${id}`,
      publisher: "Local service",
      jurisdiction: "WA",
      version: "1",
      publication_date: "2026-01-01",
      review_date: "2027-01-01",
      uploaded_at: "2026-01-01",
      indexed_at: "2026-01-01",
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
    },
    ...overrides,
  };
}

function citation(result: SearchResult, provenance: Citation["provenance"] = "model_selected"): Citation {
  return {
    chunk_id: result.id,
    document_id: result.document_id,
    title: result.title,
    file_name: result.file_name,
    page_number: result.page_number,
    chunk_index: result.chunk_index,
    provenance,
  };
}

function answer(text: string, sources: SearchResult[], citations = sources.map((item) => citation(item))): RagAnswer {
  return {
    answer: text,
    grounded: true,
    confidence: "high",
    citations,
    sources,
    routingMode: "strong",
    responseMode: "clinical_pathway",
  };
}

describe("deterministic claim support", () => {
  it("fails closed instead of silently dropping claim 25, and exposes its omitted numeric atom", () => {
    const cited = source("bounded", "Continue clozapine 25 mg daily with clinical review.");
    const supportedClaim = "Continue clozapine 25 mg daily with clinical review.";
    const overflowClaim = "Increase clozapine to 500 mg daily after review.";
    const input = answer(`${Array(24).fill(supportedClaim).join(" ")} ${overflowClaim}`, [cited]);
    input.answerSections = [{ heading: "Plan", body: overflowClaim, citation_chunk_ids: [cited.id] }];
    input.quoteCards = [{ ...citation(cited), quote: supportedClaim, section_heading: null }];

    const assessment = assessClaimSupport(input);
    expect(assessment.claims).toHaveLength(24);
    expect(assessment.claimLimitExceeded).toBe(true);

    const verified = applyNumericVerification({ ...input, supportedClaims: assessment.claims });
    expect(verified.unverifiedNumericTokens).toContain("500 mg");

    const enforced = assessAndEnforceClaimSupport(input);
    expect(enforced).toMatchObject({
      grounded: false,
      confidence: "unsupported",
      responseMode: "evidence_gap",
      routingMode: "unsupported",
    });
    expect(enforced.routingReason?.split(";").map((reason) => reason.trim())).toContain("claim_support_limit_exceeded");
    expect(enforced.citations).toEqual([]);
    expect(enforced.answerSections).toEqual([]);
    expect(enforced.quoteCards).toEqual([]);
    expect(enforced.bestSource).toBeNull();
  });

  it("keeps exactly 24 directly supported claims grounded", () => {
    const supportedClaim = "Continue clozapine 25 mg daily with clinical review.";
    const cited = source("bounded", supportedClaim);
    const input = answer(Array(24).fill(supportedClaim).join(" "), [cited]);

    expect(assessClaimSupport(input)).toMatchObject({ claimLimitExceeded: false });
    expect(assessAndEnforceClaimSupport(input)).toMatchObject({ grounded: true, confidence: "high" });
  });

  it.each([
    ["referral", "Refer the patient to the inpatient service.", "The inpatient service provides patient care."],
    ["admission", "Admit the patient to the inpatient unit.", "The inpatient unit provides patient care."],
    ["contact", "Contact the crisis team for urgent review.", "The crisis team provides urgent review."],
    ["arrangement", "Arrange follow-up with the clinic.", "Follow-up is available through the clinic."],
    ["assessment", "Assess suicide risk in the clinic.", "Suicide risk support is available in the clinic."],
    ["evaluation", "Evaluate suicide risk in the clinic.", "Suicide risk support is available in the clinic."],
    [
      "initiation",
      "Start lithium treatment for bipolar disorder.",
      "Lithium treatment is available for bipolar disorder.",
    ],
    ["discontinuation", "Stop lithium treatment after toxicity.", "Lithium treatment includes toxicity monitoring."],
    ["withholding", "Withhold lithium treatment after toxicity.", "Lithium treatment includes toxicity monitoring."],
    ["increase", "Increase lithium treatment after review.", "Lithium treatment follows clinical review."],
    ["titration", "Titrate lithium treatment after review.", "Lithium treatment follows clinical review."],
    ["decrease", "Decrease lithium treatment after review.", "Lithium treatment follows clinical review."],
    ["reduction", "Reduce lithium treatment after review.", "Lithium treatment follows clinical review."],
  ])(
    "fails closed when a prescriptive %s action is absent from otherwise related evidence",
    (_family, claim, evidence) => {
      const result = assessAndEnforceClaimSupport(answer(claim, [source("action", evidence)]));

      expect(result.responseMode).toBe("evidence_gap");
      expect(result.supportedClaims?.[0]).toMatchObject({ riskClass: "high_risk" });
      expect(result.routingReason?.split(";").map((reason) => reason.trim())).toContain(
        "claim_support_clinical_recommendation_gap",
      );
    },
  );

  it.each([
    ["Refer the patient to the inpatient service.", "Patients should be referred to the inpatient service."],
    [
      "Admit the patient to the inpatient unit.",
      "Patients requiring this level of care must be admitted to the inpatient unit.",
    ],
    ["Contact the crisis team for urgent review.", "Contact the crisis team for urgent review."],
    ["Arrange follow-up with the clinic.", "Follow-up should be arranged with the clinic."],
    ["Assess suicide risk in the clinic.", "Suicide risk must be assessed in the clinic."],
    ["Evaluate suicide risk in the clinic.", "Suicide risk evaluation is required in the clinic."],
    ["Start lithium treatment for bipolar disorder.", "Lithium treatment should be started for bipolar disorder."],
    ["Stop lithium treatment after toxicity.", "Stop lithium treatment after toxicity."],
    ["Withhold lithium treatment after toxicity.", "Lithium treatment must be withheld after toxicity."],
    ["Increase lithium treatment after review.", "Increase lithium treatment after review."],
    ["Titrate lithium treatment after review.", "Lithium treatment should be titrated after review."],
    ["Decrease lithium treatment after review.", "Decrease lithium treatment after review."],
    ["Reduce lithium treatment after review.", "Lithium treatment should be reduced after review."],
  ])("accepts a prescriptive action when cited evidence carries the same action family", (claim, evidence) => {
    const result = assessAndEnforceClaimSupport(answer(claim, [source("action", evidence)]));

    expect(result.responseMode).not.toBe("evidence_gap");
    expect(result.supportedClaims?.[0]).toMatchObject({ riskClass: "high_risk", supportStatus: "direct" });
  });

  it("does not classify descriptive can/may capability prose as a prescriptive high-risk action", () => {
    const cited = source("capability", "The clinic provides follow-up and a referral directory for patients.");
    const input = answer("The clinic can arrange follow-up and may refer patients to the service.", [cited]);
    const result = assessAndEnforceClaimSupport(input);

    expect(result.supportedClaims?.[0]?.riskClass).toBe("routine");
    expect(result.responseMode).not.toBe("evidence_gap");
    expect(result.routingReason ?? "").not.toContain("claim_support_clinical_recommendation_gap");
  });

  it("rejects a valid citation id whose chunk does not support a high-risk claim", () => {
    const cited = source("c1", "Clozapine monitoring includes regular blood counts.");
    const result = assessClaimSupport(answer("Stop clozapine when ANC is below 1.0 x10^9/L.", [cited]));
    expect(result.claims[0]).toMatchObject({ riskClass: "high_risk", supportStatus: "partial" });
  });

  it.each([
    ["Do not stop clozapine.", "Stop clozapine immediately."],
    ["Give lithium 300 mg orally twice daily.", "Give lithium 300 mg intramuscularly once daily."],
    ["Clozapine is contraindicated in pregnancy.", "Clozapine may be used during pregnancy after specialist review."],
    ["Do not use lithium in severe renal impairment.", "Lithium requires monitoring in mild renal impairment."],
    ["Avoid valproate in hepatic impairment.", "Valproate monitoring includes liver function tests."],
    ["Escalate urgently for myocarditis symptoms.", "Review myocarditis symptoms at the next appointment."],
    ["Stop clozapine below ANC 1.0 x10^9/L.", "Stop lithium below a level of 1.0 x10^9/L."],
    ["Stop clozapine when fever develops.", "Stop clozapine when myocarditis develops."],
    ["Give lithium 300 mg for bipolar disorder.", "Give lithium 300 mg for major depression."],
    ["Cease clozapine for neutropenia.", "Cease clozapine for myocarditis."],
    ["Discontinue clozapine for neutropenia.", "Discontinue clozapine for myocarditis."],
    ["Escalate urgently for neutropenia.", "Escalate urgently for myocarditis."],
  ])("does not directly support %s from mismatched evidence", (claim, evidence) => {
    const cited = source("c1", evidence);
    expect(assessClaimSupport(answer(claim, [cited])).claims[0]?.supportStatus).not.toBe("direct");
  });

  it("fails closed when a high-risk action cites a different trigger condition", () => {
    const cited = source("c1", "Stop clozapine when myocarditis develops.");
    const result = assessAndEnforceClaimSupport(answer("Stop clozapine when fever develops.", [cited]));

    expect(result).toMatchObject({ grounded: false, confidence: "unsupported", responseMode: "evidence_gap" });
    expect(result.supportedClaims?.[0]).toMatchObject({ riskClass: "high_risk", supportStatus: "partial" });
    expect(result.citations).toEqual([]);
  });

  it("supports equivalent condition-first wording without treating the action clause as the trigger", () => {
    const cited = source("c1", "Stop clozapine when fever develops.");

    expect(assessClaimSupport(answer("If fever develops, discontinue clozapine.", [cited])).claims[0]).toMatchObject({
      riskClass: "high_risk",
      supportStatus: "direct",
    });
  });

  it("uses the first indication span instead of a later duration clause", () => {
    const cited = source("c1", "Give lithium 300 mg for bipolar disorder as ongoing therapy.");

    expect(
      assessClaimSupport(answer("Give lithium 300 mg for bipolar disorder for ongoing care.", [cited])).claims[0],
    ).toMatchObject({ riskClass: "high_risk", supportStatus: "direct" });
  });

  it("evaluates section prose only against that section's citations", () => {
    const wrongSection = source("wrong", "Stop clozapine below ANC 1.0 x10^9/L.");
    const citedSection = source("cited", "Clozapine monitoring includes regular blood counts.");
    const input = answer("The sources describe clozapine monitoring.", [wrongSection, citedSection]);
    input.answerSections = [
      {
        heading: "Threshold",
        body: "Stop clozapine below ANC 1.0 x10^9/L.",
        citation_chunk_ids: [citedSection.id],
      },
    ];
    expect(assessClaimSupport(input).claims.find((claim) => claim.text.includes("Stop"))?.supportStatus).toBe(
      "partial",
    );
  });

  it("accepts exact quote and deterministic support but never review-only enrichment", () => {
    const exact = source("exact", "Stop clozapine below ANC 1.0 x10^9/L.");
    const review = source("review", "Stop lithium below a level of 1.0 x10^9/L.");
    const direct = assessClaimSupport(
      answer("Stop clozapine below ANC 1.0 x10^9/L.", [exact], [citation(exact, "exact_quote")]),
    );
    expect(direct.claims[0]?.supportStatus).toBe("direct");

    const deterministic = assessClaimSupport(
      answer("Stop clozapine below ANC 1.0 x10^9/L.", [exact], [citation(exact, "deterministic_support")]),
    );
    expect(deterministic.claims[0]?.supportStatus).toBe("direct");

    const reviewOnly = assessClaimSupport(
      answer("Stop lithium below a level of 1.0 x10^9/L.", [review], [citation(review, "review_only")]),
    );
    expect(reviewOnly.claims[0]?.supportStatus).toBe("unsupported");
  });

  it("fails closed for partial high-risk claims while retaining review sources", () => {
    const cited = source("c1", "Clozapine monitoring includes regular blood counts.");
    const result = assessAndEnforceClaimSupport(answer("Stop clozapine below ANC 1.0 x10^9/L.", [cited]));
    expect(result).toMatchObject({ grounded: false, confidence: "unsupported", responseMode: "evidence_gap" });
    expect(result.citations).toEqual([]);
    expect(result.answerSections).toEqual([]);
    expect(result.sources).toEqual([cited]);
    expect(result.routingReason).toContain("claim_support_clinical_recommendation_gap");
  });

  it("keeps routine partial prose but caps confidence", () => {
    const cited = source("c1", "The service operates a clozapine clinic.");
    const result = assessAndEnforceClaimSupport(answer("The clinic offers appointments on Tuesdays.", [cited]));
    expect(result.responseMode).not.toBe("evidence_gap");
    expect(result.confidence).toBe("medium");
  });

  it("assesses newline-delimited claims independently instead of merging their evidence scopes", () => {
    const admission = source("admission", "Admission requires referral and bed allocation.");
    const followUp = source("follow-up", "Follow-up review should occur within 72 hours.");
    const input = answer(
      "Admission requires referral and bed allocation.\nFollow-up review should occur within 72 hours.",
      [admission, followUp],
    );

    const assessment = assessClaimSupport(input);
    expect(assessment.claims).toHaveLength(2);
    expect(assessment.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "Admission requires referral and bed allocation.", supportStatus: "direct" }),
        expect.objectContaining({
          text: "Follow-up review should occur within 72 hours.",
          riskClass: "high_risk",
          supportStatus: "direct",
        }),
      ]),
    );
    expect(assessAndEnforceClaimSupport(input).responseMode).not.toBe("evidence_gap");
  });

  it("ignores incidental outdated or poor retrieval-only sources but fails closed when direct support is dangerous", () => {
    const direct = source("direct", "Stop clozapine below ANC 1.0 x10^9/L.");
    const incidental = source("incidental", "An old unrelated administrative note.", {
      source_metadata: {
        ...direct.source_metadata!,
        document_status: "outdated",
        extraction_quality: "poor",
      },
    });
    const safe = assessAndEnforceClaimSupport(
      answer("Stop clozapine below ANC 1.0 x10^9/L.", [direct, incidental], [citation(direct)]),
    );
    expect(safe.responseMode).not.toBe("evidence_gap");

    const dangerousDirect = { ...direct, source_metadata: incidental.source_metadata };
    const refused = assessAndEnforceClaimSupport(
      answer("Stop clozapine below ANC 1.0 x10^9/L.", [dangerousDirect], [citation(dangerousDirect)]),
    );
    expect(refused.responseMode).toBe("evidence_gap");
    expect(refused.routingReason).toContain("material_source_governance_gap");
  });

  it("does not let matrix-wide attribution turn lithium evidence into direct clozapine support", () => {
    const lithium = source("lithium", "Stop lithium below a level of 1.0 x10^9/L.");
    const input = answer(
      "Conflict — ANC threshold: Lithium guide: stop clozapine below ANC 1.0 x10^9/L.",
      [lithium],
      [citation(lithium, "deterministic_support")],
    );
    input.preformatted = true;
    input.responseMode = "comparison_matrix";
    input.comparisonEvaluationState = "evaluated";
    input.comparisonMatrix = {
      documents: [{ documentId: lithium.document_id, title: lithium.title, fileName: lithium.file_name }],
      rows: [
        {
          parameter: "ANC threshold",
          status: "agreement",
          entries: [
            {
              documentId: lithium.document_id,
              chunkIds: [lithium.id],
              value: "stop clozapine below ANC 1.0 x10^9/L",
              qualifiers: [],
            },
          ],
        },
      ],
    };

    const result = assessAndEnforceClaimSupport(input);
    expect(result.responseMode).toBe("evidence_gap");
    expect(result.supportedClaims?.[0]).toMatchObject({ riskClass: "high_risk", supportStatus: "partial" });
  });

  it("keeps per-source claim support isolated from another source's partial claim", () => {
    const related = source("related", "Clozapine monitoring includes regular blood counts.", {
      relevance: {
        verdict: "direct",
        label: "Direct retrieval match",
        matchedTerms: ["clozapine"],
        missingTerms: [],
        directSourceCount: 1,
        weakSourceCount: 0,
        score: 1,
        supportReason: "Direct retrieval match",
        isSourceBacked: true,
        coverageScore: 1,
        rankScore: 1,
        titleMatchedTerms: [],
        contentMatchedTerms: ["clozapine"],
        metadataMatchedTerms: [],
        chips: [],
      },
    });
    const unrelated = source("unrelated", "The service directory lists community phone numbers.");
    const result = assessClaimSupport(
      answer("Stop clozapine below ANC 1.0 x10^9/L.", [related, unrelated], [citation(related)]),
    );
    expect(result.evidenceAssessments.related).toMatchObject({ relevance: "direct", claimSupport: "partial" });
    expect(result.evidenceAssessments.unrelated).toMatchObject({ relevance: "none", claimSupport: "unsupported" });
  });

  it("fails closed when comparison prose swaps values between attributed documents", () => {
    const protocolA = source("a", "Protocol A sets the clozapine ANC threshold below 1.5 x 10^9/L.");
    const protocolB = source("b", "Protocol B sets the clozapine ANC threshold below 1.0 x 10^9/L.");
    const input = answer(
      "Conflict — ANC: Protocol A: below 1.0 x 10^9/L; Protocol B: below 1.5 x 10^9/L.",
      [protocolA, protocolB],
      [citation(protocolA, "deterministic_support"), citation(protocolB, "deterministic_support")],
    );
    input.preformatted = true;
    input.responseMode = "comparison_matrix";
    input.comparisonEvaluationState = "evaluated";
    input.comparisonMatrix = {
      documents: [
        { documentId: protocolA.document_id, title: "Protocol A", fileName: protocolA.file_name },
        { documentId: protocolB.document_id, title: "Protocol B", fileName: protocolB.file_name },
      ],
      rows: [
        {
          parameter: "ANC",
          status: "conflict",
          entries: [
            {
              documentId: protocolA.document_id,
              chunkIds: [protocolA.id],
              value: "below 1.5 x 10^9/L",
              qualifiers: [],
            },
            {
              documentId: protocolB.document_id,
              chunkIds: [protocolB.id],
              value: "below 1.0 x 10^9/L",
              qualifiers: [],
            },
          ],
        },
      ],
    };
    expect(assessAndEnforceClaimSupport(input).responseMode).toBe("evidence_gap");
  });

  it("accepts an accurately attributed comparison with a bounded non-clinical missing cell", () => {
    const protocolA = source("a", "Protocol A sets the clozapine ANC threshold below 1.5 x 10^9/L.");
    const protocolB = source("b", "Protocol B sets the clozapine ANC threshold below 1.0 x 10^9/L.");
    const protocolC = source("c", "Protocol C discusses clozapine governance without an ANC threshold.");
    const input = answer(
      "Evidence gap — ANC: Protocol A: below 1.5 x 10^9/L; Protocol B: below 1.0 x 10^9/L; Protocol C: not reported.",
      [protocolA, protocolB, protocolC],
      [citation(protocolA, "deterministic_support"), citation(protocolB, "deterministic_support")],
    );
    input.preformatted = true;
    input.responseMode = "comparison_matrix";
    input.comparisonEvaluationState = "evaluated";
    input.comparisonMatrix = {
      documents: [
        { documentId: protocolA.document_id, title: "Protocol A", fileName: protocolA.file_name },
        { documentId: protocolB.document_id, title: "Protocol B", fileName: protocolB.file_name },
        { documentId: protocolC.document_id, title: "Protocol C", fileName: protocolC.file_name },
      ],
      rows: [
        {
          parameter: "ANC",
          status: "missing",
          entries: [
            {
              documentId: protocolA.document_id,
              chunkIds: [protocolA.id],
              value: "below 1.5 x 10^9/L",
              qualifiers: [],
            },
            {
              documentId: protocolB.document_id,
              chunkIds: [protocolB.id],
              value: "below 1.0 x 10^9/L",
              qualifiers: [],
            },
            { documentId: protocolC.document_id, chunkIds: [], value: null, qualifiers: ["No evidence found for ANC"] },
          ],
        },
      ],
    };
    const result = assessAndEnforceClaimSupport(input);
    expect(result.responseMode).toBe("comparison_matrix");
    expect(result.supportedClaims?.[0]?.supportStatus).toBe("direct");
    expect(result.supportedClaims?.[0]?.supportingChunkIds).toEqual([protocolA.id, protocolB.id]);
  });

  it("uses ordinary section citations for non-preformatted comparison answers", () => {
    const cited = source("cited", "Stop clozapine below ANC 1.0 x10^9/L.");
    const input = answer("The comparison requires source review.", [cited], [citation(cited)]);
    input.responseMode = "comparison_matrix";
    input.answerSections = [
      {
        heading: "Threshold",
        body: "Stop clozapine below ANC 1.0 x10^9/L.",
        citation_chunk_ids: [cited.id],
      },
    ];
    input.comparisonMatrix = { documents: [], rows: [] };
    const claim = assessClaimSupport(input).claims.find((item) => item.text.startsWith("Stop clozapine"));
    expect(claim?.supportStatus).toBe("direct");
  });

  it("rejects an appended route and frequency absent from the attributed deterministic entry", () => {
    const protocolA = source("a", "Protocol A gives Drug A at 300 mg.");
    const input = answer(
      "Conflict — Dose: Protocol A: 300 mg intramuscularly daily.",
      [protocolA],
      [citation(protocolA, "deterministic_support")],
    );
    input.preformatted = true;
    input.responseMode = "comparison_matrix";
    input.comparisonEvaluationState = "evaluated";
    input.comparisonMatrix = {
      documents: [{ documentId: protocolA.document_id, title: "Protocol A", fileName: protocolA.file_name }],
      rows: [
        {
          parameter: "Dose",
          status: "agreement",
          entries: [{ documentId: protocolA.document_id, chunkIds: [protocolA.id], value: "300 mg", qualifiers: [] }],
        },
      ],
    };
    expect(assessAndEnforceClaimSupport(input).responseMode).toBe("evidence_gap");
  });

  it("fails closed when generated comparison clauses cross-bind Drug A and Drug B values", () => {
    const drugA = source("drug-a", "Drug A is given at 300 mg.");
    const drugB = source("drug-b", "Drug B is given at 600 mg.");
    const input = answer(
      "Drug A is given at 600 mg whereas Drug B is given at 300 mg.",
      [drugA, drugB],
      [citation(drugA), citation(drugB)],
    );
    input.responseMode = "comparison_matrix";
    input.preformatted = false;
    input.answerSections = [
      {
        heading: "Comparison",
        body: "Drug A is given at 600 mg; Drug B is given at 300 mg.",
        citation_chunk_ids: [drugA.id, drugB.id],
      },
    ];
    expect(assessAndEnforceClaimSupport(input).responseMode).toBe("evidence_gap");
  });

  it.each([
    ["Drug A is contraindicated in renal impairment.", "Drug A is contraindicated in hepatic impairment."],
    ["Stop Drug A and escalate urgently.", "Stop Drug A at the next routine appointment."],
  ])("requires every conjunctive safety dimension in %s", (claim, evidence) => {
    const cited = source("safety", evidence);
    expect(assessAndEnforceClaimSupport(answer(claim, [cited])).responseMode).toBe("evidence_gap");
  });

  it("rejects clinical recommendations appended to a deterministic missing-cell marker", () => {
    const protocolA = source("a", "Protocol A gives Drug A at 300 mg.");
    const protocolB = source("b", "Protocol B contains no attributed dose evidence for Drug A.");
    const input = answer(
      "Evidence gap — Dose: Protocol A: 300 mg; Protocol B: no evidence found, but give Drug A 600 mg daily.",
      [protocolA, protocolB],
      [citation(protocolA, "deterministic_support")],
    );
    input.preformatted = true;
    input.responseMode = "comparison_matrix";
    input.comparisonEvaluationState = "evaluated";
    input.comparisonMatrix = {
      documents: [
        { documentId: protocolA.document_id, title: "Protocol A", fileName: protocolA.file_name },
        { documentId: protocolB.document_id, title: "Protocol B", fileName: protocolB.file_name },
      ],
      rows: [
        {
          parameter: "Dose",
          status: "missing",
          entries: [
            { documentId: protocolA.document_id, chunkIds: [protocolA.id], value: "300 mg", qualifiers: [] },
            {
              documentId: protocolB.document_id,
              chunkIds: [],
              value: null,
              qualifiers: ["No evidence found for Dose"],
            },
          ],
        },
      ],
    };
    expect(assessAndEnforceClaimSupport(input).responseMode).toBe("evidence_gap");
  });

  it.each([
    ["Drug A is contraindicated.", "Drug A is not contraindicated."],
    ["Stop Drug A and escalate urgently.", "Stop Drug A; urgent escalation is not required."],
  ])("does not let a negated state verify the positive claim %s", (claim, evidence) => {
    const cited = source("negated", evidence);
    expect(assessAndEnforceClaimSupport(answer(claim, [cited])).responseMode).toBe("evidence_gap");
  });

  it("rejects an arbitrary clinical suffix after a parameter-scoped missing marker", () => {
    const protocolA = source("a", "Protocol A gives Drug A at 300 mg.");
    const protocolB = source("b", "Protocol B contains no attributed dose evidence for Drug A.");
    const input = answer(
      "Evidence gap — Dose: Protocol A: 300 mg; Protocol B: no evidence found for dose give Drug A 600 mg daily.",
      [protocolA, protocolB],
      [citation(protocolA, "deterministic_support")],
    );
    input.preformatted = true;
    input.responseMode = "comparison_matrix";
    input.comparisonEvaluationState = "evaluated";
    input.comparisonMatrix = {
      documents: [
        { documentId: protocolA.document_id, title: "Protocol A", fileName: protocolA.file_name },
        { documentId: protocolB.document_id, title: "Protocol B", fileName: protocolB.file_name },
      ],
      rows: [
        {
          parameter: "Dose",
          status: "missing",
          entries: [
            { documentId: protocolA.document_id, chunkIds: [protocolA.id], value: "300 mg", qualifiers: [] },
            {
              documentId: protocolB.document_id,
              chunkIds: [],
              value: null,
              qualifiers: ["No evidence found for Dose"],
            },
          ],
        },
      ],
    };
    expect(assessAndEnforceClaimSupport(input).responseMode).toBe("evidence_gap");
  });

  it.each(["must not stop", "should not cease", "never discontinue"])(
    "does not verify %s against positive stop evidence",
    (negativeAction) => {
      const cited = source("stop", "Stop Drug A immediately.");
      expect(assessAndEnforceClaimSupport(answer(`${negativeAction} Drug A.`, [cited])).responseMode).toBe(
        "evidence_gap",
      );
    },
  );

  it("accepts the exact parameter-scoped missing-cell form", () => {
    const protocolA = source("a", "Protocol A gives Drug A at 300 mg.");
    const protocolB = source("b", "Protocol B contains no attributed dose evidence for Drug A.");
    const input = answer(
      "Evidence gap — Dose: Protocol A: 300 mg; Protocol B: no evidence found for Dose.",
      [protocolA, protocolB],
      [citation(protocolA, "deterministic_support")],
    );
    input.preformatted = true;
    input.responseMode = "comparison_matrix";
    input.comparisonEvaluationState = "evaluated";
    input.comparisonMatrix = {
      documents: [
        { documentId: protocolA.document_id, title: "Protocol A", fileName: protocolA.file_name },
        { documentId: protocolB.document_id, title: "Protocol B", fileName: protocolB.file_name },
      ],
      rows: [
        {
          parameter: "Dose",
          status: "missing",
          entries: [
            { documentId: protocolA.document_id, chunkIds: [protocolA.id], value: "300 mg", qualifiers: [] },
            {
              documentId: protocolB.document_id,
              chunkIds: [],
              value: null,
              qualifiers: ["No evidence found for Dose"],
            },
          ],
        },
      ],
    };
    const result = assessAndEnforceClaimSupport(input);
    expect(result.responseMode).toBe("comparison_matrix");
    expect(result.supportedClaims?.[0]?.supportStatus).toBe("direct");
  });
});

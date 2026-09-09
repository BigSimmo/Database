import { buildRagQueryPlan, coverageQueryForSubquestion } from "@/lib/rag/rag-query-plan";
import { evaluateEvidenceCoverageGate } from "@/lib/rag/rag-coverage-gate";
import { analyzeClinicalQuery } from "@/lib/clinical-search";
import { describe, expect, it } from "vitest";

import {
  answerCoverageFromSelections,
  evaluateAnswerCoverage,
  evaluateShadowCandidateMatchCounts,
  mergeEvidenceByCoverageAndSourceRole,
} from "@/lib/rag/rag-coverage";
import { sanitizeRagCandidateMatchCounts } from "@/lib/rag/rag-contracts";
import type { RagQueryPlan, SearchResult, SourcePolicyConflict } from "@/lib/types";

function result(id: string, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    document_id: `document-${id}`,
    title: "Clinical guidance",
    file_name: "guidance.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "Monitor the patient and escalate when the threshold is reached.",
    image_ids: [],
    similarity: 0.8,
    images: [],
    corpus_scope: "uploaded_local",
    site_content_domain: null,
    ...overrides,
  };
}

const plan: RagQueryPlan = {
  version: "rag-query-plan-v1",
  kind: "decomposed",
  originalQuery: "How should this be managed and monitored?",
  interpretation: "management and monitoring",
  subquestions: [
    { id: "sq-1", question: "What is the primary management?", purpose: "primary", required: true },
    { id: "sq-2", question: "What monitoring is required?", purpose: "monitoring", required: true },
  ],
  targetSiteDomains: [],
  siteDomainDecision: "none",
  reasonCodes: ["broad_management"],
};

describe("P12C facet-bound coverage", () => {
  const query = "What monitoring and risks apply to lithium?";
  const monitoring = result("lithium-monitoring", {
    title: "Lithium monitoring",
    section_heading: null,
    content: "Lithium monitoring includes renal function every six months. Check lithium levels every three months.",
    source_metadata: {
      corpus_scope: "uploaded_local",
      source_role: "local_guideline",
      source_kind: "document",
      content_mode: "indexed_content",
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
      source_title: "Lithium monitoring",
      publisher: "Synthetic local service",
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
    },
  });
  it.each([
    "Lithium levels are checked in adults every three months.",
    "Lithium levels and renal function are checked in adults every three months.",
    "Valproate levels fluctuate and lithium levels and renal function are checked in adults every three months.",
  ])("P12C R4 admits adult context owned by the measured predicate: %s", (content) => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked in adults?", [{ ...monitoring, content }]),
    ).toMatchObject({ accepted: true, reason: "bound_monitoring_frequency_evidence" });
  });
  it.each([
    "Lithium levels are checked every three months.",
    "Lithium levels are checked in children every three months.",
    "Lithium levels are not checked in adults every three months.",
    "Valproate levels are checked in adults at baseline and lithium levels are checked every three months.",
    "Valproate levels fluctuate in adults and lithium levels are checked every three months.",
    "Lithium levels are checked every three months and check valproate levels in adults.",
    "Lithium levels are checked every three months and valproate levels are checked in adults.",
    "Lithium levels are checked every three months. Valproate levels are checked in adults at baseline.",
  ])("P12C R4 gates missing, conflicting or foreign adult context: %s", (content) => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked in adults?", [{ ...monitoring, content }]),
    ).toMatchObject({ accepted: false, reason: "missing_bound_monitoring_frequency_evidence" });
  });
  it("P12C R4 gates an omitted qualifier beyond adult population", () => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked in older adults?", [
        { ...monitoring, content: "Lithium levels are checked in adults every three months." },
      ]),
    ).toMatchObject({ accepted: false, reason: "missing_bound_monitoring_frequency_evidence" });
  });
  it.each([
    "Lithium levels remain normal at baseline and valproate levels are checked every three months.",
    "Lithium levels fluctuate and valproate levels are checked every three months.",
    "Lithium levels and symptoms fluctuate and valproate levels are checked every three months.",
    "Lithium levels and clinical status remains stable and valproate levels are checked every three months.",
    "Lithium levels fluctuate and thyroid function are checked every three months.",
  ])("P12C R3 rejects descriptive clauses at the measurement gate: %s", (content) => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked?", [{ ...monitoring, content }]).accepted,
    ).toBe(false);
  });
  it.each([
    "Lithium levels and renal function are checked every three months.",
    "Valproate levels fluctuate and lithium levels and renal function are checked every three months.",
  ])("P12C R3 admits a demonstrated passive renal measurement list: %s", (content) => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked?", [{ ...monitoring, content }]).accepted,
    ).toBe(true);
  });
  it.each([
    "Lithium levels and impaired renal function are checked every three months.",
    "Lithium levels and renal function are checked every three months in children.",
    "Lithium levels and renal function are not checked every three months.",
  ])("P12C R3 gates passive subject restrictions: %s", (content) => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked?", [{ ...monitoring, content }]).accepted,
    ).toBe(false);
  });
  it.each([
    "Lithium levels and thyroid function are checked every three months.",
    "Lithium levels and blood pressure are checked every three months.",
    "Valproate levels are checked at baseline and lithium levels and thyroid function are checked every three months.",
  ])("P12C R2 admits a shared passive measurement predicate: %s", (content) => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked?", [{ ...monitoring, content }]),
    ).toMatchObject({ accepted: true, reason: "bound_monitoring_frequency_evidence" });
  });
  it.each([
    "Lithium levels are normal at baseline and valproate levels are checked every three months.",
    "Lithium levels are checked at baseline and valproate levels and blood pressure are checked every three months.",
  ])("P12C R2 gates actual separate passive predicates: %s", (content) => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked?", [{ ...monitoring, content }]).accepted,
    ).toBe(false);
  });
  it.each([
    "Check lithium levels at baseline and check renal function every six months.",
    "Check lithium levels and check valproate levels every three months.",
    "Lithium levels are checked at baseline and valproate levels are checked every three months.",
    "Every three months, check valproate levels and check lithium levels at baseline.",
  ])("P12C R1 gates cadence at its own predicate: %s", (content) => {
    expect(
      evaluateEvidenceCoverageGate("How often are lithium levels checked?", [{ ...monitoring, content }]),
    ).toMatchObject({ accepted: false, reason: "missing_bound_monitoring_frequency_evidence" });
  });
  it("P12C R1 admits coordinated measurement objects without erasing patient restrictions", () => {
    const question = "How often are lithium levels checked?";
    expect(
      evaluateEvidenceCoverageGate(question, [
        { ...monitoring, content: "Check lithium levels and renal function every three months." },
      ]).accepted,
    ).toBe(true);
    for (const content of [
      "Check lithium levels and renal function impairment every three months.",
      "Check lithium levels every three months in renal impairment.",
      "Check lithium levels and renal function every three months in children.",
      "Do not check lithium levels and renal function every three months.",
    ])
      expect(evaluateEvidenceCoverageGate(question, [{ ...monitoring, content }]).accepted).toBe(false);
  });
  it.each([
    "before treatment",
    "after treatment",
    "until treatment",
    "unless treatment is stopped",
    "if treatment is stopped",
    "when treatment is stopped",
  ])("P12C R1 preserves a required temporal or conditional qualifier: %s", (qualifier) => {
    const constrained = `What monitoring and risks apply to lithium ${qualifier}?`;
    const requested = buildRagQueryPlan(constrained, analyzeClinicalQuery(constrained));
    const part = requested.subquestions.find(
      (part) => part.requestedFacets?.length === 1 && part.requestedFacets[0] === "monitoring",
    )!;
    expect.soft(coverageQueryForSubquestion(requested, part)).toContain(qualifier);
    const lanes = mergeEvidenceByCoverageAndSourceRole({ plan: requested, candidates: [monitoring] });
    const lane = lanes.find((lane) => lane.subquestionId === part.id);
    expect(lane).toBeDefined();
    expect(lane?.coverageReason).not.toBe("direct");
    const coverage = answerCoverageFromSelections({
      plan: requested,
      selectedEvidence: [monitoring],
      selections: lanes,
    });
    expect(coverage.coverage.find((entry) => entry.subquestionId === part.id)?.status).not.toBe("direct");
    expect(coverage.overall).not.toBe("complete");
  });
  it("P12C gates a measurement cadence separately from medication dosing", () => {
    const q = "How often are lithium levels checked?";
    expect(evaluateEvidenceCoverageGate(q, [monitoring])).toMatchObject({
      accepted: true,
      reason: "bound_monitoring_frequency_evidence",
    });
    for (const content of [
      "Check lithium levels.",
      "Check valproate levels every three months.",
      "Check lithium levels. Check renal function every three months.",
      "Check lithium levels in children every three months.",
      "Check lithium levels every three months with renal impairment.",
      "Do not check lithium levels every three months.",
      "Check lithium levels during daily treatment.",
    ])
      expect(evaluateEvidenceCoverageGate(q, [{ ...monitoring, content }]).accepted).toBe(false);
    for (const question of [
      "How often are lithium levels checked in adults?",
      "What lithium dose and frequency are used?",
      "How often is lithium dosed?",
      "What oral lithium dose and monitoring frequency are used?",
      "How often are lithium levels checked and doses increased?",
    ])
      expect(evaluateEvidenceCoverageGate(question, [monitoring]).accepted).toBe(false);
  });
  it("closes only the supported monitoring facet and leaves the combined and risk lanes incomplete", () => {
    const requested = buildRagQueryPlan(query, analyzeClinicalQuery(query));
    const lanes = mergeEvidenceByCoverageAndSourceRole({ plan: requested, candidates: [monitoring] });
    expect(lanes.map((lane) => lane.coverageReason)).toEqual(["partial", "direct", "partial"]);
    expect(lanes[1]!.orderedEvidence.map((row) => row.id)).toEqual([monitoring.id]);
  });
  it("does not promote wrong medicines or subject-only evidence to direct facet coverage", () => {
    const requested = buildRagQueryPlan(query, analyzeClinicalQuery(query));
    for (const candidate of [
      { ...monitoring, title: "Valproate monitoring", content: "Valproate monitoring includes renal function." },
      { ...monitoring, title: "Lithium", content: "Lithium is listed in the formulary." },
    ]) {
      const lanes = mergeEvidenceByCoverageAndSourceRole({ plan: requested, candidates: [candidate] });
      expect(lanes[1]!.coverageReason).not.toBe("direct");
    }
  });
  it("keeps population and negated clinical constraints in facet evaluation", () => {
    const constrained = "What monitoring and risks apply to lithium in adults without renal impairment?";
    const requested = buildRagQueryPlan(constrained, analyzeClinicalQuery(constrained));
    const lanes = mergeEvidenceByCoverageAndSourceRole({ plan: requested, candidates: [monitoring] });
    expect(lanes[1]!.coverageReason).not.toBe("direct");
  });
  it("refuses fabricated service bindings and leaves ordinary unbound questions unchanged", () => {
    const requested = buildRagQueryPlan(query, analyzeClinicalQuery(query));
    const forged: RagQueryPlan = {
      ...requested,
      askedParts: ["monitoring", "service_workflow"],
      subquestions: [
        {
          id: "sq-3",
          question: `${query} Focus on the requested service_workflow.`,
          purpose: "primary",
          required: true,
          requestedFacets: ["service_workflow"],
        },
      ],
    };
    expect(coverageQueryForSubquestion(forged, forged.subquestions[0]!)).toBe(forged.subquestions[0]!.question);
    expect(
      coverageQueryForSubquestion(requested, {
        ...requested.subquestions[1]!,
        question: "A manually written monitoring question",
      }),
    ).toBe("A manually written monitoring question");
    const tool = result("tool", {
      corpus_scope: "clinical_kb_site",
      site_content_domain: "tools",
      title: "Lithium monitoring tool",
      content: "Lithium monitoring and risk tool record.",
      source_metadata: {
        ...monitoring.source_metadata!,
        corpus_scope: "clinical_kb_site",
        source_kind: "registry_record",
        source_role: "tool_reference",
      },
    });
    expect(
      mergeEvidenceByCoverageAndSourceRole({ plan: requested, candidates: [tool] }).every(
        (lane) => lane.orderedEvidence.length === 0,
      ),
    ).toBe(true);
    expect(mergeEvidenceByCoverageAndSourceRole({ plan: forged, candidates: [tool] })[0]!.claimRole).not.toBe(
      "service_workflow",
    );
  });
  it.each(["partial", "absent", "unreviewed", "complete"] as const)(
    "composes whole-request coverage only from complete independent facets: %s",
    (state) => {
      const requested = buildRagQueryPlan(query, analyzeClinicalQuery(query));
      const risk = result("lithium-risk", {
        ...monitoring,
        id: "lithium-risk",
        content: "Lithium risks include toxicity.",
      });
      const coverage = evaluateAnswerCoverage({
        plan: requested,
        selectedEvidence: [monitoring, risk],
        evidenceBySubquestion: requested.subquestions.map((part, index) => ({
          subquestionId: part.id,
          selectedChunkIds: index === 2 ? (state === "absent" ? [] : [risk.id]) : [monitoring.id],
          citedChunkIds: index === 2 ? (state === "absent" ? [] : [risk.id]) : [monitoring.id],
          eligibleChunkIds: [monitoring.id, risk.id],
          support: index === 0 || (index === 2 && state === "partial") ? "partial" : "direct",
          reasonCodes: index === 2 && state === "unreviewed" ? ["source_policy_not_evaluated"] : [],
        })),
      });
      if (state === "complete") {
        expect(coverage.overall).toBe("complete");
        expect(coverage.coverage[0]).toMatchObject({
          status: "direct",
          reasonCodes: ["composed_from_direct_facet_coverage"],
        });
      } else expect(coverage.overall).not.toBe("complete");
    },
  );
});

describe("answer coverage", () => {
  it("T8-R3 cannot mark dosing-only evidence complete for requested dosing, monitoring and risks", () => {
    const query = "Give lithium dosing, monitoring and risks";
    const requested = buildRagQueryPlan(query, analyzeClinicalQuery(query));
    const coverage = evaluateAnswerCoverage({
      plan: requested,
      selectedEvidence: [
        result("dose", {
          title: "Synthetic lithium dosing fixture",
          section_heading: "Dosing",
          content: "Lithium dose: 100 mg orally once daily. Synthetic test content, not clinical guidance.",
        }),
      ],
      evidenceBySubquestion: requested.subquestions.map((part) => ({
        subquestionId: part.id,
        selectedChunkIds: part.purpose === "primary" || part.purpose === "required_action" ? ["dose"] : [],
        citedChunkIds: part.purpose === "primary" || part.purpose === "required_action" ? ["dose"] : [],
        eligibleChunkIds: ["dose"],
        support: "direct",
      })),
    });
    expect(requested.subquestions).toHaveLength(4);
    const doseOnly = buildRagQueryPlan("Lithium dosing", analyzeClinicalQuery("Lithium dosing"));
    const doseControl = evaluateAnswerCoverage({
      plan: doseOnly,
      selectedEvidence: [result("dose", { content: "Lithium dose: 100 mg orally once daily." })],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: ["dose"],
          citedChunkIds: ["dose"],
          eligibleChunkIds: ["dose"],
          support: "direct",
        },
      ],
    });
    expect(doseControl.overall).toBe("complete");
    expect(coverage.overall).not.toBe("complete");
    expect(coverage.coverage.filter((part) => part.status === "absent").map((part) => part.subquestionId)).toEqual(
      expect.arrayContaining(
        requested.subquestions
          .filter((part) => part.purpose === "monitoring" || part.purpose === "risk")
          .map((part) => part.id),
      ),
    );
  });
  it("P08C retains useful cross-domain catalogue evidence under an inferred preference", () => {
    const lookup: RagQueryPlan = {
      ...plan,
      originalQuery: "Find lithium catalogue",
      kind: "single",
      subquestions: [{ id: "lookup", question: "Find lithium catalogue", purpose: "primary", required: true }],
      targetSiteDomains: ["medications"],
      siteDomainDecision: "inferred",
    };
    const service = result("service", {
      title: "Lithium catalogue",
      content: "Lithium catalogue entry for the local clinic service.",
      corpus_scope: "clinical_kb_site",
      site_content_domain: "services",
      source_metadata: {
        source_kind: "registry_record",
        corpus_scope: "clinical_kb_site",
        source_role: "service_directory",
        content_mode: "indexed_content",
        document_status: "current",
        clinical_validation_status: "approved",
        extraction_quality: "good",
      } as SearchResult["source_metadata"],
    });
    expect(
      mergeEvidenceByCoverageAndSourceRole({ plan: lookup, candidates: [service] })[0]?.orderedEvidence.map(
        (row) => row.id,
      ),
    ).toEqual(["service"]);
    expect(evaluateShadowCandidateMatchCounts({ ...lookup, siteDomainDecision: "explicit" }, [service]).matched).toBe(
      0,
    );
  });

  it("counts only directly selected and cited chunks, never metadata-only candidates", () => {
    const coverage = evaluateAnswerCoverage({
      plan,
      selectedEvidence: [result("direct"), result("metadata-only")],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: ["direct"],
          citedChunkIds: ["direct"],
          eligibleChunkIds: ["direct"],
          support: "direct",
        },
        {
          subquestionId: "sq-2",
          selectedChunkIds: ["metadata-only"],
          citedChunkIds: [],
          eligibleChunkIds: ["metadata-only"],
          support: "direct",
        },
      ],
    });

    expect(coverage.coverage).toEqual([
      expect.objectContaining({ subquestionId: "sq-1", status: "direct", chunkIds: ["direct"] }),
      expect.objectContaining({ subquestionId: "sq-2", status: "absent", chunkIds: [] }),
    ]);
    expect(coverage.overall).toBe("partial");
    expect(coverage.insufficiencyReason).toBe("insufficient_claim_support");
  });

  it("rejects absent, unknown, and mislabelled registry scopes instead of guessing", () => {
    const unscoped = result("unscoped");
    delete unscoped.corpus_scope;
    const unknown = result("unknown", { corpus_scope: "external" as SearchResult["corpus_scope"] });
    const mislabelledRegistry = result("registry", {
      corpus_scope: "uploaded_local",
      source_metadata: { source_kind: "registry_record" } as SearchResult["source_metadata"],
    });
    const siteWithoutDomain = result("site-without-domain", { corpus_scope: "clinical_kb_site" });
    const localWithDomain = result("local-with-domain", {
      corpus_scope: "uploaded_local",
      site_content_domain: "services",
    });

    const coverage = evaluateAnswerCoverage({
      plan: { ...plan, kind: "single", subquestions: [plan.subquestions[0]] },
      selectedEvidence: [unscoped, unknown, mislabelledRegistry, siteWithoutDomain, localWithDomain],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: ["unscoped", "unknown", "registry", "site-without-domain", "local-with-domain"],
          citedChunkIds: ["unscoped", "unknown", "registry", "site-without-domain", "local-with-domain"],
          eligibleChunkIds: ["unscoped", "unknown", "registry", "site-without-domain", "local-with-domain"],
          support: "direct",
        },
      ],
    });

    expect(coverage.coverage[0]).toMatchObject({ status: "absent", chunkIds: [] });
    expect(coverage.coverage[0].reasonCodes).toEqual(expect.arrayContaining(["candidate_scope_rejected"]));
    expect(coverage.insufficiencyReason).toBe("governance_block");
  });

  it("marks a canonical conflict only when both conflict sides remain directly cited", () => {
    const conflict = {
      id: "conflict-1",
      local: { supportingChunkIds: ["local"] },
      australian: { supportingChunkIds: ["australian"] },
    } as SourcePolicyConflict;
    const coverage = evaluateAnswerCoverage({
      plan: { ...plan, kind: "single", subquestions: [plan.subquestions[0]] },
      selectedEvidence: [result("local"), result("australian", { corpus_scope: "australian_public" })],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: ["local", "australian"],
          citedChunkIds: ["local", "australian"],
          eligibleChunkIds: ["local", "australian"],
          support: "direct",
        },
      ],
      conflicts: [conflict],
    });

    expect(coverage.coverage[0]).toMatchObject({
      status: "conflicting",
      chunkIds: ["local", "australian"],
    });
    expect(coverage.conflicts).toEqual([conflict]);
    expect(coverage.overall).toBe("conflicting");
    expect(coverage.insufficiencyReason).toBe("source_conflict");
  });

  it("cannot promote evidence rejected by the canonical clinical gate to direct coverage", () => {
    const query = "What ANC threshold means withhold clozapine?";
    const thresholdPlan: RagQueryPlan = {
      ...plan,
      kind: "single",
      originalQuery: query,
      subquestions: [{ id: "sq-1", question: query, purpose: "primary", required: true }],
    };
    const rejected = result("rejected", {
      content: "General clozapine information without a blood threshold or action.",
      similarity: 0.99,
    });

    const coverage = evaluateAnswerCoverage({
      plan: thresholdPlan,
      selectedEvidence: [rejected],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: ["rejected"],
          citedChunkIds: ["rejected"],
          eligibleChunkIds: ["rejected"],
          support: "direct",
        },
      ],
    });

    expect(coverage.coverage[0]).toMatchObject({ status: "absent", chunkIds: [] });
    expect(coverage.coverage[0].reasonCodes).toContain(
      "evidence_gate:missing_clozapine_blood_action_structured_threshold",
    );
    expect(coverage.overall).not.toBe("complete");
  });

  it("fails closed when an eligibility decision is omitted", () => {
    const coverage = evaluateAnswerCoverage({
      plan: { ...plan, kind: "single", subquestions: [plan.subquestions[0]] },
      selectedEvidence: [result("unchecked")],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: ["unchecked"],
          citedChunkIds: ["unchecked"],
          support: "direct",
        } as never,
      ],
    });

    expect(coverage.coverage[0]).toMatchObject({ status: "absent", chunkIds: [] });
    expect(coverage.coverage[0].reasonCodes).toContain("eligibility_decision_missing");
    expect(coverage.overall).toBe("absent");
    expect(coverage.insufficiencyReason).toBe("insufficient_claim_support");
    expect(coverage.insufficiencyReason).not.toBe("not_in_corpus");
  });

  it("fails closed when a direct-support decision is omitted even for eligible cited evidence", () => {
    const coverage = evaluateAnswerCoverage({
      plan: { ...plan, kind: "single", subquestions: [plan.subquestions[0]] },
      selectedEvidence: [result("unchecked-support")],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: ["unchecked-support"],
          citedChunkIds: ["unchecked-support"],
          eligibleChunkIds: ["unchecked-support"],
        } as never,
      ],
    });

    expect(coverage.coverage[0]).toMatchObject({ status: "absent", chunkIds: [] });
    expect(coverage.coverage[0].reasonCodes).toContain("direct_support_decision_missing");
    expect(coverage.conflicts).toEqual([]);
    expect(coverage.insufficiencyReason).toBe("insufficient_claim_support");
  });

  it("does not let an asserted not_in_corpus verdict override missing eligibility or retrieved candidates", () => {
    const coverage = evaluateAnswerCoverage({
      plan: { ...plan, kind: "single", subquestions: [plan.subquestions[0]] },
      selectedEvidence: [result("unchecked")],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: ["unchecked"],
          citedChunkIds: ["unchecked"],
          support: "direct",
        } as never,
      ],
      insufficiencyReason: "not_in_corpus",
    });

    expect(coverage.insufficiencyReason).toBe("insufficient_claim_support");
  });

  it("uses not_in_corpus only when healthy zero-candidate retrieval supplies that explicit verdict", () => {
    const coverage = evaluateAnswerCoverage({
      plan: { ...plan, kind: "single", subquestions: [plan.subquestions[0]] },
      selectedEvidence: [],
      evidenceBySubquestion: [
        {
          subquestionId: "sq-1",
          selectedChunkIds: [],
          citedChunkIds: [],
          eligibleChunkIds: [],
          support: "direct",
        },
      ],
      insufficiencyReason: "not_in_corpus",
    });

    expect(coverage.overall).toBe("absent");
    expect(coverage.insufficiencyReason).toBe("not_in_corpus");
  });

  it("rejects bounded counters whose total cannot match the query plan", () => {
    expect(sanitizeRagCandidateMatchCounts({ matched: 1, partial_match: 0, absent: 3 }, 4)).toEqual({
      matched: 1,
      partial_match: 0,
      absent: 3,
    });
    expect(sanitizeRagCandidateMatchCounts({ matched: 1, partial_match: 0, absent: 1 }, 4)).toBeUndefined();
    expect(sanitizeRagCandidateMatchCounts({ matched: 5, partial_match: 0, absent: 0 }, 5)).toBeUndefined();
  });

  it("fails closed when shadow candidates are irrelevant or have unknown canonical scope", () => {
    const singlePlan = {
      ...plan,
      kind: "single" as const,
      originalQuery: "How is catatonia managed?",
      subquestions: [
        { id: "sq-1", question: "How is catatonia managed?", purpose: "primary" as const, required: true },
      ],
    };
    const counts = evaluateShadowCandidateMatchCounts(singlePlan, [
      result("irrelevant", {
        title: "Clozapine blood monitoring",
        content: "Check the full blood count weekly during clozapine initiation.",
        relevance: {
          verdict: "direct",
          label: "Direct support",
          matchedTerms: ["catatonia", "managed"],
          missingTerms: [],
          directSourceCount: 1,
          weakSourceCount: 0,
          score: 1,
          supportReason: "Stale relevance computed for a different query.",
          isSourceBacked: true,
          coverageScore: 1,
          rankScore: 1,
          titleMatchedTerms: ["catatonia"],
          contentMatchedTerms: ["managed"],
          metadataMatchedTerms: [],
          chips: ["direct evidence"],
        },
      }),
      result("unknown-scope", {
        title: "Catatonia management",
        content: "Catatonia management requires urgent clinical assessment.",
        corpus_scope: "external" as SearchResult["corpus_scope"],
      }),
    ]);

    expect(counts).toEqual({ matched: 0, partial_match: 0, absent: 1 });
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(singlePlan.subquestions.length);
  });
});

import { describe, expect, it } from "vitest";

import { buildAdaptiveAnswerPlan } from "@/lib/rag/adaptive-answer-plan";
import type { AdaptiveAnswerRequest, AnswerCoveragePlan, SourcePolicyConflict } from "@/lib/types";

const request: AdaptiveAnswerRequest = {
  askedParts: ["monitoring"],
  requestedDepth: "standard",
  materialSafetyDependencies: [],
  sourcePolicy: "primary_plus_approved_supplements",
  subquestions: [{ id: "sq-1", question: "What monitoring is required?", purpose: "monitoring", required: true }],
};

// Synthetic packed-coverage records. No prose, metadata match or model output
// stands in for coverage; removing the supporting chunk is the negative control.
const complete: AnswerCoveragePlan = {
  interpretation: "requested monitoring",
  ambiguity: null,
  subquestions: request.subquestions,
  coverage: [{ subquestionId: "sq-1", status: "direct", chunkIds: ["chunk-monitoring"], reasonCodes: [] }],
  conflicts: [],
  overall: "complete",
  insufficiencyReason: null,
};

const args = {
  queryClass: "table_threshold",
  intent: "drug_dosing",
  simpleDirect: true,
  requestPlan: request,
  coverage: complete,
} as const;

describe("adaptive answer plan", () => {
  it("keeps a direct fact narrow and separates concise from detailed allocation without mandatory padding", () => {
    const concise = buildAdaptiveAnswerPlan({ ...args, requestPlan: { ...request, requestedDepth: "concise" } });
    const detailed = buildAdaptiveAnswerPlan({ ...args, requestPlan: { ...request, requestedDepth: "detailed" } });
    expect(concise.shape).toBe("narrow");
    expect(detailed.shape).toBe("narrow");
    expect(concise.allocation.tier).toBe("concise");
    expect(detailed.allocation.tier).toBe("detailed");
    expect(detailed.allocation.requiredFirst).toBe(true);
    expect(detailed.allocation.padToMinimum).toBe(false);
    expect(detailed.requiredAskedParts).toEqual(["monitoring"]);
    expect(detailed.requireExactGap).toBe(false);
  });

  it("supports broad and comparison shapes without making menu categories required facts", () => {
    const askedParts = ["assessment", "differential", "rationale"] as const;
    const subquestions = askedParts.map((part) => ({
      id: part,
      question: `Requested ${part}`,
      purpose: "primary" as const,
      required: true,
    }));
    const broadCoverage: AnswerCoveragePlan = {
      ...complete,
      subquestions,
      coverage: subquestions.map((part) => ({
        subquestionId: part.id,
        status: "direct",
        chunkIds: [`chunk-${part.id}`],
        reasonCodes: [],
      })),
    };
    const broadArgs = {
      ...args,
      queryClass: "broad_summary" as const,
      intent: "protocol" as const,
      simpleDirect: false,
      requestPlan: { ...request, askedParts: [...askedParts], subquestions },
      coverage: broadCoverage,
    };
    const broad = buildAdaptiveAnswerPlan({
      ...broadArgs,
    });
    expect(broad.shape).toBe("comprehensive");
    expect(broad.requiredAskedParts).toEqual(["assessment", "differential", "rationale"]);
    expect(broad.optionalSectionKinds).toContain("documentation");
    expect(broad.requireExactGap).toBe(false);
    const partial = buildAdaptiveAnswerPlan({
      ...broadArgs,
      coverage: {
        ...broadCoverage,
        overall: "partial",
        coverage: broadCoverage.coverage.filter((part) => part.subquestionId !== "rationale"),
      },
    });
    expect(partial.shape).toBe("partial");
    expect(partial.exactGapSubquestionIds).toEqual(["rationale"]);
    expect(partial.supportedSubquestionIds).toEqual(["assessment", "differential"]);
    expect(partial.requiredAskedParts).toEqual(broad.requiredAskedParts);
    expect(
      buildAdaptiveAnswerPlan({ ...args, queryClass: "comparison", intent: "comparison", simpleDirect: false }).shape,
    ).toBe("comparison");
    expect(buildAdaptiveAnswerPlan({ ...args, simpleDirect: false }).shape).toBe("focused");
  });

  it("does not manufacture partial status from absent optional enrichment", () => {
    const optional = {
      id: "optional",
      question: "Related documentation",
      purpose: "primary",
      required: false,
    } as const;
    const plan = buildAdaptiveAnswerPlan({
      ...args,
      requestPlan: { ...request, subquestions: [...request.subquestions, optional] },
      coverage: {
        ...complete,
        overall: "partial",
        subquestions: [...complete.subquestions, optional],
        coverage: [
          ...complete.coverage,
          { subquestionId: "optional", status: "absent", chunkIds: [], reasonCodes: ["not_in_corpus"] },
        ],
      },
    });
    expect(plan.shape).toBe("narrow");
    expect(plan.requireExactGap).toBe(false);
    expect(plan.exactGapSubquestionIds).toEqual([]);
    expect(plan.supportedSubquestionIds).toEqual(["sq-1"]);
  });

  it("names the exact required gap while preserving independently supported coverage", () => {
    const safety = {
      id: "sq-2",
      question: "What safety implications affect dosing?",
      purpose: "risk",
      required: true,
    } as const;
    const coverage: AnswerCoveragePlan = {
      ...complete,
      overall: "partial",
      subquestions: [...complete.subquestions, safety],
      coverage: [
        ...complete.coverage,
        { subquestionId: "sq-2", status: "absent", chunkIds: [], reasonCodes: ["missing_safety_support"] },
      ],
    };
    const plan = buildAdaptiveAnswerPlan({
      ...args,
      requestPlan: {
        ...request,
        materialSafetyDependencies: ["risk"],
        subquestions: [...request.subquestions, safety],
      },
      coverage,
    });
    expect(plan).toMatchObject({
      shape: "partial",
      requireExactGap: true,
      exactGapSubquestionIds: ["sq-2"],
      supportedSubquestionIds: ["sq-1"],
      missingSafetyDependencies: ["risk"],
    });
    expect(plan.requiredCoverage[1]).toMatchObject({ question: safety.question, coverage: coverage.coverage[1] });
    expect(plan.requiredAskedParts).toEqual(["monitoring"]);
    expect(plan.materialSafetyDependencies).toEqual(["risk"]);
    const supported = buildAdaptiveAnswerPlan({
      ...args,
      requestPlan: {
        ...request,
        materialSafetyDependencies: ["risk"],
        subquestions: [...request.subquestions, safety],
      },
      coverage: {
        ...coverage,
        overall: "complete",
        coverage: [
          complete.coverage[0],
          { subquestionId: "sq-2", status: "direct", chunkIds: ["chunk-safety"], reasonCodes: [] },
        ],
      },
    });
    expect(supported.requireExactGap).toBe(false);
    expect(supported.missingSafetyDependencies).toEqual([]);
  });

  it("fails closed on missing coverage and on a declared direct record without supporting chunks", () => {
    for (const coverage of [
      { ...complete, coverage: [] },
      { ...complete, coverage: [{ ...complete.coverage[0], chunkIds: [] }] },
    ]) {
      const plan = buildAdaptiveAnswerPlan({ ...args, coverage });
      expect(plan.requireExactGap).toBe(true);
      expect(plan.exactGapSubquestionIds).toEqual(["sq-1"]);
      expect(plan.supportedSubquestionIds).toEqual([]);
    }
    expect(
      buildAdaptiveAnswerPlan({ ...args, coverage: { ...complete, coverage: [] } }).requiredCoverage[0].coverage,
    ).toBeNull();
  });

  it("does not treat an omitted required request subquestion as complete coverage", () => {
    const missing = { id: "sq-2", question: "Requested dosing", purpose: "required_action", required: true } as const;
    const plan = buildAdaptiveAnswerPlan({
      ...args,
      requestPlan: {
        ...request,
        askedParts: ["dosing", "monitoring"],
        subquestions: [...request.subquestions, missing],
      },
    });
    expect(plan.exactGapSubquestionIds).toEqual(["sq-2"]);
    expect(plan.supportedSubquestionIds).toEqual(["sq-1"]);
  });

  it("keeps a required material safety dependency visible even if planning omitted its subquestion", () => {
    const plan = buildAdaptiveAnswerPlan({
      ...args,
      requestPlan: { ...request, materialSafetyDependencies: ["risk"] },
    });
    expect(plan.shape).toBe("partial");
    expect(plan.missingSafetyDependencies).toEqual(["risk"]);
    expect(plan.supportedSubquestionIds).toEqual(["sq-1"]);
  });

  it("carries only a material targeted clarification and handles entirely absent coverage", () => {
    const ambiguity = {
      material: true,
      dimensions: ["population"],
      clarificationQuestion: "Adult or adolescent?",
    } as const;
    const plan = buildAdaptiveAnswerPlan({
      ...args,
      coverage: {
        ...complete,
        ambiguity: { ...ambiguity, dimensions: [...ambiguity.dimensions] },
        overall: "absent",
        coverage: [{ ...complete.coverage[0], status: "absent", chunkIds: [] }],
      },
    });
    expect(plan).toMatchObject({
      shape: "partial",
      requireExactGap: true,
      clarificationQuestion: "Adult or adolescent?",
    });
    expect(
      buildAdaptiveAnswerPlan({
        ...args,
        coverage: { ...complete, ambiguity: { ...ambiguity, dimensions: [...ambiguity.dimensions], material: false } },
      }).clarificationQuestion,
    ).toBeNull();
  });

  it("requires a visible conflict only from the canonical reviewed conflict payload", () => {
    const side = {
      documentId: "local-doc",
      catalogueKey: "synthetic",
      title: "Synthetic policy",
      publisher: "Synthetic publisher",
      publicationDate: null,
      effectiveFrom: null,
      jurisdiction: "AU",
      sourceRole: "local_guideline" as const,
      supportingChunkIds: ["chunk-local"],
    };
    const conflict = {
      version: "source-policy-conflict-v1",
      id: "conflict-1",
      claimRole: "dose_or_monitoring",
      topicKey: "synthetic-monitoring",
      local: { ...side, corpusScope: "uploaded_local" },
      australian: {
        ...side,
        documentId: "public-doc",
        corpusScope: "australian_public",
        supportingChunkIds: ["chunk-public"],
      },
      overlapReason: "same_claim",
      materialDifferenceReason: "monitoring_differs",
      localPrimaryDecision: { selected: "uploaded_local", reason: "current_valid_accessible_directly_supportive" },
      reviewTargetDocumentId: "local-doc",
    } satisfies SourcePolicyConflict;
    const plan = buildAdaptiveAnswerPlan({
      ...args,
      coverage: {
        ...complete,
        overall: "conflicting",
        conflicts: [conflict],
        coverage: [{ ...complete.coverage[0], status: "conflicting", chunkIds: ["chunk-local", "chunk-public"] }],
      },
    });
    expect(plan).toMatchObject({ shape: "partial", requireConflictSection: true, requireExactGap: true });
    expect(plan.conflicts).toEqual([conflict]);
    expect(plan.optionalSectionKinds).not.toContain("source_conflict");
    expect(
      buildAdaptiveAnswerPlan({
        ...args,
        coverage: {
          ...complete,
          overall: "conflicting",
          coverage: [{ ...complete.coverage[0], status: "conflicting" }],
        },
      }).requireConflictSection,
    ).toBe(false);
  });

  it("preserves explicit source restrictions without widening evidence or changing required allocation", () => {
    const restricted = buildAdaptiveAnswerPlan({
      ...args,
      requestPlan: { ...request, sourcePolicy: "only_this_source" },
    });
    const allowed = buildAdaptiveAnswerPlan(args);
    expect(restricted.sourcePolicy).toBe("only_this_source");
    expect(allowed.sourcePolicy).toBe("primary_plus_approved_supplements");
    expect(restricted.requiredCoverage).toEqual(allowed.requiredCoverage);
    expect(restricted.allocation).toEqual(allowed.allocation);
  });
});

import { describe, expect, it } from "vitest";

import {
  RAG_PROGRAMME_GATE_POLICY,
  compareRagProgrammeRuns,
  evaluateRagProgrammeCase,
  fingerprintRagProgrammeCaseSet,
  fingerprintRagProgrammePopulation,
  ragProgrammeFixture,
  type RagProgrammeEvalArtifact,
  type RagProgrammeEvaluationCase,
} from "@/lib/rag/rag-programme-eval";

function evaluationCase(
  id: string,
  overrides: Partial<RagProgrammeEvaluationCase["diagnostics"]> = {},
): RagProgrammeEvaluationCase {
  const fixtureCase = ragProgrammeFixture.cases.find((item) => item.id === id);
  if (!fixtureCase) throw new Error(`Missing programme fixture case: ${id}`);
  return {
    ...fixtureCase,
    diagnostics: {
      observedCorpusScopes: fixtureCase.expectation.expectedCorpusScopes,
      observedSourceRoles: fixtureCase.expectation.expectedSourceRoles,
      observedSiteDomains: fixtureCase.expectation.expectedSiteDomains,
      publicSiteContentState: fixtureCase.expectation.expectedPublicSiteContentState,
      answerShape: fixtureCase.expectation.allowedAnswerShapes[0],
      directSubquestionPurposes: fixtureCase.expectation.expectedSubquestionPurposes,
      directEvidenceSubquestionCount: fixtureCase.expectation.minimumDirectSubquestions,
      insufficiencyReason: null,
      supportedPartRetained: fixtureCase.expectation.requireSupportedPart,
      exactGapNamed: fixtureCase.expectation.requireExactGap,
      visibleConflictFields: fixtureCase.expectation.expectedConflict?.requireVisibleFields ?? [],
      requiredFactsPresent: fixtureCase.expectation.requiredFacts,
      forbiddenPatternsFound: [],
      documentReciprocalRank: fixtureCase.expectedDocuments.length > 0 ? 1 : 0,
      contentReciprocalRank: fixtureCase.expectation.requiredFacts.length > 0 ? 1 : 0,
      hardViolations: [],
      totalLatencyMs: 100,
      estimatedCostUsd: 0.01,
      ...overrides,
    },
  };
}

function artifact(cases: ReturnType<typeof evaluateRagProgrammeCase>[]): RagProgrammeEvalArtifact {
  return {
    schemaVersion: 1,
    evaluatedGitSha: "0123456789abcdef0123456789abcdef01234567",
    evaluationVariant: "legacy",
    caseSetFingerprint: ragProgrammeFixture.caseSetFingerprint,
    populationFingerprint: fingerprintRagProgrammePopulation({
      sourcePolicyVersion: "source-policy-v1",
      indexGeneration: "index-generation-v1",
      siteContentRegistryVersion: "site-registry-v1",
      publicSiteContentReleaseId: "site-release-v1",
      publicSiteContentStaticManifestDigest: "sha256:static",
      publicSiteContentDynamicStateDigest: "sha256:dynamic",
      publicSiteContentReleaseDigest: "sha256:release",
      publicSiteContentState: "current",
      publicSiteContentSnapshotFingerprint: "sha256:snapshot",
    }),
    sourcePolicyVersion: "source-policy-v1",
    indexGeneration: "index-generation-v1",
    siteContentRegistryVersion: "site-registry-v1",
    publicSiteContentReleaseId: "site-release-v1",
    publicSiteContentStaticManifestDigest: "sha256:static",
    publicSiteContentDynamicStateDigest: "sha256:dynamic",
    publicSiteContentReleaseDigest: "sha256:release",
    publicSiteContentState: "current",
    publicSiteContentSnapshotFingerprint: "sha256:snapshot",
    promptVersion: "clinical-rag-answer-v19",
    rolloutMode: "legacy",
    cases,
    aggregates: {
      documentRecall: 1,
      contentRecall: 1,
      falseInsufficiencyRate: 0,
      supportedPartRetentionRate: 1,
      p95TotalLatencyMs: 100,
      estimatedCostUsd: 0.01,
    },
  };
}

describe("RAG programme case evaluation", () => {
  it("marks a generic refusal as false insufficiency when direct evidence exists", () => {
    const result = evaluateRagProgrammeCase(
      evaluationCase("direct-evidence-generic-refusal", {
        insufficiencyReason: "not_in_corpus",
        supportedPartRetained: false,
      }),
    );

    expect(result).toMatchObject({ falseInsufficiency: true, passed: false });
  });

  it("passes a partial answer only when it retains support and names the exact gap", () => {
    const result = evaluateRagProgrammeCase(evaluationCase("broad-multi-intent-partial"));

    expect(result).toMatchObject({ supportedPartRetained: true, falseInsufficiency: false, passed: true });
  });

  it("fails a conflict case unless the complete canonical conflict is visible", () => {
    const result = evaluateRagProgrammeCase(
      evaluationCase("uploaded-public-conflict", {
        visibleConflictFields: [
          "source_identity",
          "jurisdiction",
          "material_difference",
          "local_primary_decision",
          "review_flag",
        ],
      }),
    );

    expect(result).toMatchObject({
      passed: false,
      hardViolations: expect.arrayContaining(["conflict_contract"]),
    });
    expect(result.failedExpectations).toEqual(expect.arrayContaining(["publication_or_effective_date", "source_role"]));
  });

  it("rejects non-finite or negative evaluator metrics", () => {
    expect(() =>
      evaluateRagProgrammeCase(evaluationCase("narrow-fact-concise", { totalLatencyMs: Number.NaN })),
    ).toThrow(/totalLatencyMs/i);
    expect(() => evaluateRagProgrammeCase(evaluationCase("narrow-fact-concise", { estimatedCostUsd: -0.01 }))).toThrow(
      /estimatedCostUsd/i,
    );
  });

  it("loads a privacy-reviewed stable fixture without prose or identifiers", () => {
    expect(fingerprintRagProgrammeCaseSet(ragProgrammeFixture.cases)).toBe(ragProgrammeFixture.caseSetFingerprint);
    expect(ragProgrammeFixture.cases.length).toBeGreaterThanOrEqual(20);
    expect(ragProgrammeFixture.cases.every((item) => item.privacyReview.status === "approved_deidentified")).toBe(true);
    expect(JSON.stringify(ragProgrammeFixture)).not.toMatch(
      /patientName|queryText|answerText|providerOutput|administratorId|userId/i,
    );
  });
});

describe("RAG programme aggregate gate", () => {
  const passingCases = [
    evaluateRagProgrammeCase(evaluationCase("broad-multi-intent-partial")),
    evaluateRagProgrammeCase(evaluationCase("narrow-fact-concise")),
  ];
  const baseline = artifact(passingCases);
  const candidate: RagProgrammeEvalArtifact = {
    ...baseline,
    evaluationVariant: "candidate",
    rolloutMode: "canary",
    promptVersion: "clinical-rag-answer-v20",
  };

  it("records the approved thresholds in one immutable policy constant", () => {
    expect(RAG_PROGRAMME_GATE_POLICY).toEqual({
      version: "rag-programme-gate-v1",
      requireDocumentRecall: 1,
      requireContentRecall: 1,
      maximumHardViolations: 0,
      maximumPerCaseRankRegressions: 0,
      maximumP95LatencyMultiplier: 1.1,
      maximumEstimatedCostMultiplier: 1.15,
    });
  });

  it("accepts a complete candidate with identical cases and evaluated population", () => {
    expect(compareRagProgrammeRuns(baseline, candidate)).toEqual({ decision: "GO", reasons: [] });
  });

  it.each([
    "healthdirect_used",
    "link_only_content_used",
    "access_boundary",
    "site_public_read_mismatch",
    "site_non_admin_mutation",
    "conflict_contract",
    "incremental_reconciliation",
  ] as const)("fails the run for one %s violation", (violation) => {
    const failedCase = { ...candidate.cases[0], passed: false, hardViolations: [violation] };
    expect(compareRagProgrammeRuns(baseline, { ...candidate, cases: [failedCase, candidate.cases[1]] }).decision).toBe(
      "NO_GO",
    );
  });

  it("fails when either case-set or evaluated-population fingerprints differ", () => {
    expect(compareRagProgrammeRuns(baseline, { ...candidate, caseSetFingerprint: "different" }).decision).toBe("NO_GO");
    expect(compareRagProgrammeRuns(baseline, { ...candidate, populationFingerprint: "different" }).decision).toBe(
      "NO_GO",
    );
  });

  it("fails when any must-pass case fails despite perfect aggregate recall", () => {
    const failedCase = {
      ...candidate.cases[0],
      passed: false,
      failedExpectations: ["visible_conflict_metadata_missing"],
    };
    expect(compareRagProgrammeRuns(baseline, { ...candidate, cases: [failedCase, candidate.cases[1]] }).decision).toBe(
      "NO_GO",
    );
  });

  it("fails closed on duplicate cases and invalid aggregate metrics", () => {
    expect(
      compareRagProgrammeRuns(baseline, { ...candidate, cases: [candidate.cases[0], candidate.cases[0]] }).decision,
    ).toBe("NO_GO");
    expect(
      compareRagProgrammeRuns(baseline, {
        ...candidate,
        aggregates: { ...candidate.aggregates, p95TotalLatencyMs: Number.POSITIVE_INFINITY },
      }).decision,
    ).toBe("NO_GO");
  });
});

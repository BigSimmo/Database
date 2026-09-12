import { describe, expect, it } from "vitest";

import rawProgrammeFixture from "../src/data/rag-programme-failures.v1.json";
import {
  RAG_PROGRAMME_GATE_POLICY,
  compareRagProgrammeRuns,
  evaluateRagProgrammeCase,
  fingerprintRagProgrammeCaseSet,
  fingerprintRagProgrammePopulation,
  ragProgrammeFixture,
  validateRagProgrammeFixture,
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
      observedConflict: fixtureCase.expectation.expectedConflict
        ? {
            localDocumentId: fixtureCase.expectation.expectedConflict.localDocumentId,
            australianDocumentId: fixtureCase.expectation.expectedConflict.australianDocumentId,
            visibleFields: fixtureCase.expectation.expectedConflict.requireVisibleFields,
          }
        : null,
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
  const canonicalById = new Map(ragProgrammeFixture.cases.map((testCase) => [testCase.id, testCase]));
  const documentCases = cases.filter((testCase) => (canonicalById.get(testCase.id)?.expectedDocuments.length ?? 0) > 0);
  const contentCases = cases.filter(
    (testCase) => (canonicalById.get(testCase.id)?.expectation.requiredFacts.length ?? 0) > 0,
  );
  const falseInsufficiencyCases = cases.filter(
    (testCase) => (canonicalById.get(testCase.id)?.expectation.minimumDirectSubquestions ?? 0) > 0,
  );
  const retentionCases = cases.filter(
    (testCase) => canonicalById.get(testCase.id)?.expectation.requireSupportedPart === true,
  );
  const latencies = cases
    .flatMap((testCase) => (testCase.totalLatencyMs === null ? [] : [testCase.totalLatencyMs]))
    .sort((left, right) => left - right);
  const costs = cases.flatMap((testCase) => (testCase.estimatedCostUsd === null ? [] : [testCase.estimatedCostUsd]));
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
      documentRecall:
        documentCases.length === 0
          ? 1
          : documentCases.filter((testCase) => testCase.documentReciprocalRank > 0).length / documentCases.length,
      contentRecall:
        contentCases.length === 0
          ? 1
          : contentCases.filter((testCase) => testCase.contentReciprocalRank > 0).length / contentCases.length,
      falseInsufficiencyRate:
        falseInsufficiencyCases.length === 0
          ? 0
          : falseInsufficiencyCases.filter((testCase) => testCase.falseInsufficiency).length /
            falseInsufficiencyCases.length,
      supportedPartRetentionRate:
        retentionCases.length === 0
          ? 1
          : retentionCases.filter((testCase) => testCase.supportedPartRetained).length / retentionCases.length,
      p95TotalLatencyMs: latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0,
      estimatedCostUsd: costs.length === cases.length ? costs.reduce((total, value) => total + value, 0) : null,
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

  it("does not call a supported partial answer false insufficiency when it retains support and names the residual gap", () => {
    const result = evaluateRagProgrammeCase(
      evaluationCase("broad-multi-intent-partial", {
        insufficiencyReason: "retrieval_miss",
        supportedPartRetained: true,
        exactGapNamed: true,
      }),
    );

    expect(result).toMatchObject({ supportedPartRetained: true, falseInsufficiency: false, passed: true });
  });

  it("fails a conflict case unless the complete canonical conflict is visible", () => {
    const result = evaluateRagProgrammeCase(
      evaluationCase("uploaded-public-conflict", {
        observedConflict: {
          localDocumentId: "fixture-local-conflict-guideline",
          australianDocumentId: "fixture-australian-conflict-guideline",
          visibleFields: [
            "source_identity",
            "jurisdiction",
            "material_difference",
            "local_primary_decision",
            "review_flag",
          ],
        },
      }),
    );

    expect(result).toMatchObject({
      passed: false,
      hardViolations: expect.arrayContaining(["conflict_contract"]),
    });
    expect(result.failedExpectations).toEqual(expect.arrayContaining(["publication_or_effective_date", "source_role"]));
  });

  it("fails a conflict case when visible fields describe the wrong document pair", () => {
    const fixtureCase = ragProgrammeFixture.cases.find((item) => item.id === "uploaded-public-conflict");
    const result = evaluateRagProgrammeCase(
      evaluationCase("uploaded-public-conflict", {
        observedConflict: {
          localDocumentId: "wrong-local-document",
          australianDocumentId: "wrong-australian-document",
          visibleFields: fixtureCase?.expectation.expectedConflict?.requireVisibleFields ?? [],
        },
      }),
    );

    expect(result).toMatchObject({
      passed: false,
      hardViolations: expect.arrayContaining(["conflict_contract"]),
    });
    expect(result.failedExpectations).toEqual(expect.arrayContaining(["local_document_id", "australian_document_id"]));
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
    expect(ragProgrammeFixture.cases).toHaveLength(26);
    expect(ragProgrammeFixture.cases.every((item) => item.privacyReview.status === "approved_deidentified")).toBe(true);
    expect(JSON.stringify(ragProgrammeFixture)).not.toMatch(
      /patientName|queryText|answerText|providerOutput|administratorId|userId/i,
    );
  });

  it("rejects every unknown fixture field and fingerprints the complete allowed payload", () => {
    expect(() => validateRagProgrammeFixture({ ...rawProgrammeFixture, unknownTopLevel: true })).toThrow(/unknown/i);

    const nestedUnknown: unknown = structuredClone(rawProgrammeFixture);
    const firstNestedCase = (nestedUnknown as { cases: Array<{ expectation: Record<string, unknown> }> }).cases[0]!;
    firstNestedCase.expectation.opaqueNote = "an arbitrary unreviewed field";
    expect(() => validateRagProgrammeFixture(nestedUnknown)).toThrow(/unknown/i);

    const changedAllowedPayload = structuredClone(rawProgrammeFixture);
    changedAllowedPayload.cases[0]!.privacyReview.reviewedOn = "2026-08-21";
    expect(() => validateRagProgrammeFixture(changedAllowedPayload)).toThrow(/fingerprint mismatch/i);
  });

  it("exposes the complete canonical fixture as recursively immutable", () => {
    const canonicalCase = ragProgrammeFixture.cases[0]!;
    const originalFingerprint = ragProgrammeFixture.caseSetFingerprint;
    const originalBudget = canonicalCase.latencyTargetMs;

    expect(Object.isFrozen(ragProgrammeFixture)).toBe(true);
    expect(Object.isFrozen(ragProgrammeFixture.cases)).toBe(true);
    expect(Object.isFrozen(canonicalCase)).toBe(true);
    expect(Object.isFrozen(canonicalCase.privacyReview)).toBe(true);
    expect(Object.isFrozen(canonicalCase.expectedDocuments)).toBe(true);
    expect(Object.isFrozen(canonicalCase.expectation)).toBe(true);
    expect(Object.isFrozen(canonicalCase.expectation.expectedCorpusScopes)).toBe(true);
    expect(() => {
      (canonicalCase as unknown as { latencyTargetMs: number }).latencyTargetMs = originalBudget + 60_000;
    }).toThrow(TypeError);
    expect(() => {
      (canonicalCase.expectation.expectedCorpusScopes as unknown as string[]).push("international_supplementary");
    }).toThrow(TypeError);
    expect(canonicalCase.latencyTargetMs).toBe(originalBudget);
    expect(ragProgrammeFixture.caseSetFingerprint).toBe(originalFingerprint);
  });

  it("rejects empty core population identifiers and invalid site partition states before fingerprinting", () => {
    const validPopulation = {
      sourcePolicyVersion: "source-policy-v1",
      indexGeneration: "index-generation-v1",
      siteContentRegistryVersion: "site-registry-v1",
      publicSiteContentReleaseId: "site-release-v1",
      publicSiteContentStaticManifestDigest: "sha256:static",
      publicSiteContentDynamicStateDigest: "sha256:dynamic",
      publicSiteContentReleaseDigest: "sha256:release",
      publicSiteContentState: "current" as const,
      publicSiteContentSnapshotFingerprint: "sha256:snapshot",
    };

    for (const field of ["sourcePolicyVersion", "indexGeneration", "siteContentRegistryVersion"] as const) {
      expect(() => fingerprintRagProgrammePopulation({ ...validPopulation, [field]: " " })).toThrow(field);
    }
    expect(() =>
      fingerprintRagProgrammePopulation({
        ...validPopulation,
        publicSiteContentState: "not_a_partition_state" as never,
      }),
    ).toThrow(/publicSiteContentState/);
  });
});

describe("RAG programme aggregate gate", () => {
  const passingCases = ragProgrammeFixture.cases.map((testCase) =>
    evaluateRagProgrammeCase(evaluationCase(testCase.id)),
  );
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

  it("fails when both artifacts omit the same canonical must-pass cases", () => {
    expect(
      compareRagProgrammeRuns(
        { ...baseline, cases: baseline.cases.slice(0, -1) },
        { ...candidate, cases: candidate.cases.slice(0, -1) },
      ),
    ).toMatchObject({
      decision: "NO_GO",
      reasons: expect.arrayContaining([expect.stringMatching(/missing_canonical_case/)]),
    });
  });

  it("fails when both artifacts share a noncanonical case fingerprint", () => {
    const alteredCases = candidate.cases.map((testCase, index) =>
      index === 0 ? { ...testCase, caseFingerprint: "sha256:altered" } : testCase,
    );

    expect(
      compareRagProgrammeRuns({ ...baseline, cases: alteredCases }, { ...candidate, cases: alteredCases }),
    ).toMatchObject({
      decision: "NO_GO",
      reasons: expect.arrayContaining([expect.stringMatching(/noncanonical_case_fingerprint/)]),
    });
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
    expect(
      compareRagProgrammeRuns(baseline, { ...candidate, cases: [failedCase, ...candidate.cases.slice(1)] }).decision,
    ).toBe("NO_GO");
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
    expect(
      compareRagProgrammeRuns(baseline, { ...candidate, cases: [failedCase, ...candidate.cases.slice(1)] }).decision,
    ).toBe("NO_GO");
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

  it("fails closed when per-case facts and aggregate claims are internally inconsistent", () => {
    const inconsistentCases = candidate.cases.map((testCase) => ({
      ...testCase,
      passed: true,
      failedExpectations: [],
      hardViolations: [],
      falseInsufficiency: false,
      supportedPartRetained: false,
      documentReciprocalRank: 0,
      contentReciprocalRank: 0,
    }));
    const inconsistentBaseline = { ...baseline, cases: inconsistentCases };
    const inconsistentCandidate = { ...candidate, cases: inconsistentCases };

    expect(compareRagProgrammeRuns(inconsistentBaseline, inconsistentCandidate)).toMatchObject({
      decision: "NO_GO",
      reasons: expect.arrayContaining([expect.stringMatching(/aggregate|supported_part|expected_document/)]),
    });
  });

  it("fails when a canonical case exceeds its existing latency budget even without a relative regression", () => {
    const overBudgetCases = candidate.cases.map((testCase) => ({
      ...testCase,
      totalLatencyMs: testCase.id === "narrow-fact-concise" ? 4_001 : testCase.totalLatencyMs,
    }));
    const overBudgetBaseline = {
      ...baseline,
      cases: overBudgetCases,
      aggregates: { ...baseline.aggregates, p95TotalLatencyMs: 100 },
    };
    const overBudgetCandidate = {
      ...candidate,
      cases: overBudgetCases,
      aggregates: { ...candidate.aggregates, p95TotalLatencyMs: 100 },
    };

    expect(compareRagProgrammeRuns(overBudgetBaseline, overBudgetCandidate)).toMatchObject({
      decision: "NO_GO",
      reasons: expect.arrayContaining(["candidate:narrow-fact-concise:latency_budget"]),
    });
  });

  it("allows an over-budget legacy baseline when the candidate is in budget and improves it", () => {
    const baselineCases = baseline.cases.map((testCase) => ({
      ...testCase,
      totalLatencyMs: testCase.id === "narrow-fact-concise" ? 4_001 : testCase.totalLatencyMs,
    }));
    const candidateCases = candidate.cases.map((testCase) => ({
      ...testCase,
      totalLatencyMs: testCase.id === "narrow-fact-concise" ? 4_000 : testCase.totalLatencyMs,
    }));

    expect(
      compareRagProgrammeRuns({ ...baseline, cases: baselineCases }, { ...candidate, cases: candidateCases }),
    ).toEqual({ decision: "GO", reasons: [] });
  });
});

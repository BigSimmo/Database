import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RANKING_SNAPSHOT_VERSION,
  evaluateRankingCases,
  scoreSnapshotCandidate,
  tuneRankingSnapshot,
  validateRankingSnapshot,
} from "../scripts/lib/ranking-tuning";
import {
  candidateFeatures,
  contentLabelMatchesWithAliases,
  documentLabelMatchesWithAliases,
  labelMatches,
} from "../scripts/lib/ranking-snapshot-builder";
import { defaultRankingConfig, neutralRankingFeatureWeights } from "../src/lib/ranking-config";

const snapshotPath = resolve("scripts/fixtures/rag-ranking-candidate-snapshot.v1.json");
const snapshotText = readFileSync(snapshotPath, "utf8");
const snapshot = validateRankingSnapshot(JSON.parse(snapshotText));

describe("offline ranking candidate snapshot", () => {
  it("matches label alternatives as complete tokens", () => {
    expect(labelMatches("ED IM PO options", "ed OR im OR po")).toBe(true);
    expect(labelMatches("managed over time with support", "ed OR im OR po")).toBe(false);
    expect(labelMatches("Full-blood-count monitoring", "full blood count")).toBe(true);
  });

  it("grades matches through the sanctioned alias tables the live eval gates use", () => {
    // Discriminating document case: the EMHS agitation guideline satisfies the pinned MHSP
    // fixture key only via clinicalDocumentAliases — raw labelMatches grades it a miss, which
    // fed the tuner mislabeled ground truth before the builder became alias-aware.
    const emhsTitle = "mental health pharmacological management of agitation and arousal guideline (emhs).pdf";
    expect(labelMatches(emhsTitle, "AgitationArousalPharmaMgt")).toBe(false);
    expect(documentLabelMatchesWithAliases(emhsTitle, "AgitationArousalPharmaMgt")).toBe(true);
    expect(documentLabelMatchesWithAliases("clozapine prescribing guideline", "AgitationArousalPharmaMgt")).toBe(false);

    // Discriminating content case: a preview spelling out "absolute neutrophil count" answers
    // the "anc" expectation only through clinicalContentAliases.
    const ancPreview = "if the absolute neutrophil count drops below 1.5 withhold clozapine";
    expect(labelMatches(ancPreview, "anc")).toBe(false);
    expect(contentLabelMatchesWithAliases(ancPreview, "anc")).toBe(true);
    // OR-alternate labels (contentExpectationLabel output) expand aliases per part.
    expect(contentLabelMatchesWithAliases("give medication as required for agitation", "prn OR stat")).toBe(true);
    expect(contentLabelMatchesWithAliases("alcohol withdrawal overview page", "ciwa")).toBe(false);
  });

  it("uses exact runtime fusion signals before legacy aggregate reconstruction", () => {
    const fusionSignals = {
      hybridRelevance: 0.71,
      lexicalCoverage: 0.12,
      reciprocalRankFusion: 0.03,
      titleSectionRelevance: 0.18,
      metadataRelevance: 0.09,
      clinicalEvidence: -0.04,
      fixedAdjustment: -0.22,
    };
    expect(
      candidateFeatures({
        hybrid_score: 0.99,
        score_explanation: {
          weightedHybridScore: 0.98,
          metadataBoost: 0.5,
          clinicalSignalBoost: 0.6,
          fusionSignals,
        },
      }),
    ).toEqual(fusionSignals);
  });

  it("is regenerated within the 30-day freshness window once provenance exists", () => {
    // The pre-provenance checked-in snapshot has no generatedAt; the gate activates on the
    // first regeneration (build:ranking-snapshot stamps it) and then blocks silent corpus
    // drift from an aging snapshot.
    if (!snapshot.generatedAt) return;
    const ageMs = Date.now() - Date.parse(snapshot.generatedAt);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const regenerate =
      "Regenerate it: download the latest eval-canary run's eval-canary-output artifact, then " +
      "`npm run build:ranking-snapshot -- --input golden-retrieval.json --output " +
      "scripts/fixtures/rag-ranking-candidate-snapshot.v1.json --source-run-id <actions-run-id>`.";
    expect(
      ageMs,
      `Ranking snapshot generatedAt (${snapshot.generatedAt}) is ${Math.round(ageMs / 86_400_000)} days old. ${regenerate}`,
    ).toBeLessThanOrEqual(thirtyDaysMs);
    expect(
      ageMs,
      `Ranking snapshot generatedAt (${snapshot.generatedAt}) is in the future. ${regenerate}`,
    ).toBeGreaterThanOrEqual(-86_400_000);
  });

  it("is versioned, complete, and excludes raw candidate/source data", () => {
    expect(snapshot.version).toBe(RANKING_SNAPSHOT_VERSION);
    expect(snapshot.cases).toHaveLength(36);
    expect(snapshot.sourceCaseCount).toBe(36);
    expect(snapshotText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
    expect(snapshotText).not.toContain("content_preview");
    expect(snapshotText).not.toContain("chunk_id");
    expect(snapshotText).not.toContain("publisher_code");
    expect(snapshotText).not.toContain("jurisdiction");
    expect(snapshotText).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  });

  it("contains graded numeric candidates and every required hard-negative category", () => {
    const candidates = snapshot.cases.flatMap((testCase) => testCase.candidates);
    const hardNegatives = candidates.filter((candidate) => candidate.hardNegative);
    expect(hardNegatives.length).toBeGreaterThanOrEqual(12);
    expect(new Set(hardNegatives.map((candidate) => candidate.hardNegative?.category))).toEqual(
      new Set([
        "dose_administration_boilerplate",
        "wrong_medication_document",
        "mismatched_threshold",
        "flowchart_missing_action",
        "document_version_duplicate",
        "comparison_single_document_crowding",
      ]),
    );
    expect(candidates.every((candidate) => candidate.candidateHash.startsWith("sha256:"))).toBe(true);
    expect(candidates.some((candidate) => candidate.relevanceGrade > 0)).toBe(true);
  });

  it("keeps governance and safety adjustments outside tunable feature weights", () => {
    const candidate = snapshot.cases[0].candidates[0];
    const low = scoreSnapshotCandidate(candidate, {
      ...neutralRankingFeatureWeights,
      clinicalEvidence: 0.5,
    });
    const high = scoreSnapshotCandidate(candidate, {
      ...neutralRankingFeatureWeights,
      clinicalEvidence: 1.5,
    });
    expect(high - low).toBeCloseTo(candidate.features.clinicalEvidence, 8);
  });

  it("rejects malformed fields before treating the snapshot as trusted", () => {
    const invalidSourceCount = structuredClone(snapshot);
    invalidSourceCount.sourceCaseCount = 35;
    expect(() => validateRankingSnapshot(invalidSourceCount)).toThrow(/sourceCaseCount/);

    const truncated = structuredClone(snapshot);
    truncated.cases = truncated.cases.slice(0, 35);
    truncated.sourceCaseCount = 35;
    expect(() => validateRankingSnapshot(truncated)).toThrow(/at least 36/);

    const invalidGeneratedAt = structuredClone(snapshot);
    invalidGeneratedAt.generatedAt = "not-a-date";
    expect(() => validateRankingSnapshot(invalidGeneratedAt)).toThrow(/generatedAt/);

    const invalidSourceRunId = structuredClone(snapshot);
    invalidSourceRunId.sourceRunId = "";
    expect(() => validateRankingSnapshot(invalidSourceRunId)).toThrow(/sourceRunId/);

    const withProvenance = structuredClone(snapshot);
    withProvenance.generatedAt = "2026-07-20T00:00:00.000Z";
    withProvenance.sourceRunId = "16412345678";
    expect(validateRankingSnapshot(withProvenance).generatedAt).toBe("2026-07-20T00:00:00.000Z");

    const invalidSanitization = structuredClone(snapshot);
    invalidSanitization.sanitization.candidateIdentity = "raw" as never;
    expect(() => validateRankingSnapshot(invalidSanitization)).toThrow(/sanitization/);

    const invalidLabels = structuredClone(snapshot);
    invalidLabels.cases[0].expectedLabels.documents = [42 as never];
    expect(() => validateRankingSnapshot(invalidLabels)).toThrow(/expectedLabels\.documents/);

    const invalidMatchFlag = structuredClone(snapshot);
    invalidMatchFlag.cases[0].candidates[0].documentMatch = "false" as never;
    expect(() => validateRankingSnapshot(invalidMatchFlag)).toThrow(/match flags/);

    const invalidHardNegative = structuredClone(snapshot);
    const hardNegative = invalidHardNegative.cases
      .flatMap((testCase) => testCase.candidates)
      .find((candidate) => candidate.hardNegative);
    expect(hardNegative).toBeDefined();
    hardNegative!.hardNegative = null as never;
    expect(() => validateRankingSnapshot(invalidHardNegative)).toThrow(/invalid hard negative/);
  });
});

describe("offline ranking tuner", () => {
  it("reports missing-positive retrieval separately from hard-negative ordering", () => {
    const missingPositiveCases = snapshot.cases.filter((testCase) =>
      ["agitation-im-po-options", "flowchart-next-step"].includes(testCase.id),
    );
    const metrics = evaluateRankingCases(missingPositiveCases, neutralRankingFeatureWeights);
    expect(metrics.missingPositiveCases).toBe(2);
    expect(metrics.hardNegativeAccuracy).toBe(1);
    expect(metrics.highRiskHardNegativeFailures).toBe(0);
  });

  it("keeps the golden-regression hard negatives below the first relevant candidate at production weights", () => {
    // The four cases that failed the 2026-07-19 live golden retrieval eval on the raw #901
    // ordering (remediated same-day by #913-#926). This gate keys on relevanceGrade-derived
    // metrics (missing positives, hard-negative ordering), not on documentMatch flags, so
    // grading changes in the (now alias-aware) snapshot builder only reach it through a
    // deliberate snapshot regeneration. It exercises the snapshot proxy scorer at production
    // weights — a complementary floor, not a test of the selectRetrievalEvidence comparator
    // (tests/rag-fast-path-ordering.test.ts covers that).
    const goldenRegressionCaseIds = [
      "lithium-therapy-monitoring",
      "clozapine-anc-threshold",
      "alcohol-ciwa-threshold",
      "patient-safety-plan-include",
    ];
    for (const caseId of goldenRegressionCaseIds) {
      const testCase = snapshot.cases.find((item) => item.id === caseId);
      expect(testCase, caseId).toBeDefined();
      const metrics = evaluateRankingCases([testCase!], defaultRankingConfig.featureFusion[testCase!.queryClass]);
      expect(metrics.missingPositiveCases, caseId).toBe(0);
      expect(metrics.highRiskHardNegativeFailures, caseId).toBe(0);
      expect(metrics.hardNegativeAccuracy, caseId).toBe(1);
    }
  });

  it("keeps the full snapshot free of high-risk hard-negative failures at neutral weights", () => {
    const metrics = evaluateRankingCases(snapshot.cases, neutralRankingFeatureWeights);
    expect(metrics.highRiskHardNegativeFailures).toBe(0);
  });

  it("is deterministic and only selects constrained improvements", () => {
    const first = tuneRankingSnapshot(snapshot);
    const second = tuneRankingSnapshot(snapshot);
    expect(second).toEqual(first);
    for (const recommendation of first) {
      if (recommendation.selected === "neutral") {
        expect(recommendation.metrics).toEqual(recommendation.baseline);
        continue;
      }
      expect(recommendation.metrics.objective).toBeGreaterThan(recommendation.baseline.objective);
      expect(recommendation.metrics.documentRecallAt5).toBeGreaterThanOrEqual(
        recommendation.baseline.documentRecallAt5,
      );
      expect(recommendation.metrics.contentRecallAt5).toBeGreaterThanOrEqual(recommendation.baseline.contentRecallAt5);
      expect(recommendation.metrics.highRiskHardNegativeFailures).toBe(0);
      expect(recommendation.distanceFromCurrent).toBeGreaterThan(0);
    }
    expect(first.find((item) => item.queryClass === "broad_summary")?.weights).toEqual(
      defaultRankingConfig.featureFusion.broad_summary,
    );
  });
});

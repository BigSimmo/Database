import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RANKING_SNAPSHOT_VERSION,
  scoreSnapshotCandidate,
  tuneRankingSnapshot,
  validateRankingSnapshot,
} from "../scripts/lib/ranking-tuning";
import { defaultRankingConfig, neutralRankingFeatureWeights } from "../src/lib/ranking-config";

const snapshotPath = resolve("scripts/fixtures/rag-ranking-candidate-snapshot.v1.json");
const snapshotText = readFileSync(snapshotPath, "utf8");
const snapshot = validateRankingSnapshot(JSON.parse(snapshotText));

describe("offline ranking candidate snapshot", () => {
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
});

describe("offline ranking tuner", () => {
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

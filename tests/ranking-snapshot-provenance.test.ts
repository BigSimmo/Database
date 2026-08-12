import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRankingSnapshot } from "../scripts/lib/ranking-tuning";

type RankingSnapshotSourceProvenance = {
  schema: "rag-ranking-snapshot-source-provenance";
  version: 1;
  sourceRunId: string;
  sourceRunStartedAt: string;
};

const snapshot = validateRankingSnapshot(
  JSON.parse(readFileSync(resolve("scripts/fixtures/rag-ranking-candidate-snapshot.v1.json"), "utf8")),
);
const sourceProvenance = JSON.parse(
  readFileSync(resolve("scripts/fixtures/rag-ranking-candidate-snapshot.v1.provenance.json"), "utf8"),
) as Partial<RankingSnapshotSourceProvenance>;

describe("ranking snapshot source provenance", () => {
  it("anchors the 30-day freshness window to the source canary run", () => {
    expect(sourceProvenance.schema).toBe("rag-ranking-snapshot-source-provenance");
    expect(sourceProvenance.version).toBe(1);
    expect(sourceProvenance.sourceRunId).toMatch(/^\d+$/);
    expect(sourceProvenance.sourceRunId).toBe(snapshot.sourceRunId);

    const sourceRunStartedAtMs = Date.parse(sourceProvenance.sourceRunStartedAt ?? "");
    expect(Number.isFinite(sourceRunStartedAtMs), "sourceRunStartedAt must be an ISO date-time string").toBe(true);

    const regenerate =
      "Regenerate the ranking snapshot from a newer successful eval-canary artifact and update " +
      "rag-ranking-candidate-snapshot.v1.provenance.json with that run's id and run_started_at timestamp.";
    const ageMs = Date.now() - sourceRunStartedAtMs;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(
      ageMs,
      `Ranking snapshot source run (${sourceProvenance.sourceRunStartedAt}) is ${Math.round(
        ageMs / 86_400_000,
      )} days old. ${regenerate}`,
    ).toBeLessThanOrEqual(thirtyDaysMs);
    expect(
      ageMs,
      `Ranking snapshot source run (${sourceProvenance.sourceRunStartedAt}) is in the future. ${regenerate}`,
    ).toBeGreaterThanOrEqual(-86_400_000);
    expect(
      sourceRunStartedAtMs,
      "The source canary cannot start after the local snapshot was generated.",
    ).toBeLessThanOrEqual(Date.parse(snapshot.generatedAt));
  });
});

import { describe, expect, it } from "vitest";
import { isActiveAgentEnrichmentJob } from "../src/lib/ingestion-mutation-safety";

describe("active enrichment-agent detection (R24d)", () => {
  const now = Date.parse("2026-07-07T00:00:00.000Z");
  const staleAfterMinutes = 45;

  it("treats a freshly-locked processing agent job as live (blocks route enrichment)", () => {
    expect(
      isActiveAgentEnrichmentJob(
        { status: "processing", locked_at: "2026-07-06T23:50:00.000Z", updated_at: "2026-07-06T23:50:00.000Z" },
        staleAfterMinutes,
        now,
      ),
    ).toBe(true);
  });

  it("treats a processing job with a stale lease as dead (does not block)", () => {
    expect(
      isActiveAgentEnrichmentJob(
        { status: "processing", locked_at: "2026-07-06T22:00:00.000Z", updated_at: "2026-07-06T22:00:00.000Z" },
        staleAfterMinutes,
        now,
      ),
    ).toBe(false);
  });

  it("never blocks on steady-state pending or completed agent jobs", () => {
    for (const status of ["pending", "completed", "failed", "needs_enrichment_artifacts"]) {
      expect(
        isActiveAgentEnrichmentJob(
          { status, locked_at: "2026-07-06T23:59:00.000Z", updated_at: "2026-07-06T23:59:00.000Z" },
          staleAfterMinutes,
          now,
        ),
      ).toBe(false);
    }
  });

  it("treats a just-claimed processing job with no timestamps as live (conservative block)", () => {
    expect(
      isActiveAgentEnrichmentJob({ status: "processing", locked_at: null, updated_at: null }, staleAfterMinutes, now),
    ).toBe(true);
  });

  it("falls back to updated_at when the lock timestamp is missing", () => {
    expect(
      isActiveAgentEnrichmentJob(
        { status: "processing", locked_at: null, updated_at: "2026-07-06T23:58:00.000Z" },
        staleAfterMinutes,
        now,
      ),
    ).toBe(true);
    expect(
      isActiveAgentEnrichmentJob(
        { status: "processing", locked_at: null, updated_at: "2026-07-06T21:00:00.000Z" },
        staleAfterMinutes,
        now,
      ),
    ).toBe(false);
  });
});

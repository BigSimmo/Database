import { describe, it, expect, beforeEach } from "vitest";
import {
  computeOverallHealthStatus,
  recordClaimProcessed,
  getLastClaimProcessedAt,
  setLastClaimProcessedAtForTests,
  resetHealthStateForTests,
} from "../worker/health";

describe("worker health status computation", () => {
  beforeEach(() => {
    resetHealthStateForTests();
  });

  it("reports 'ok' when there are no errors and no claims have run yet", () => {
    const status = computeOverallHealthStatus(false, null);
    expect(status).toBe("ok");
  });

  it("reports 'ok' when there are no errors and the last claim was recent", () => {
    const now = Date.now();
    const recentClaim = new Date(now - 60 * 1000); // 1 minute ago
    const status = computeOverallHealthStatus(false, recentClaim, now);
    expect(status).toBe("ok");
  });

  it("reports 'degraded' when there are no errors but the last claim is stale (> 5 minutes)", () => {
    const now = Date.now();
    const staleClaim = new Date(now - 6 * 60 * 1000); // 6 minutes ago
    const status = computeOverallHealthStatus(false, staleClaim, now);
    expect(status).toBe("degraded");
  });

  it("reports 'error' when hasErrors is true, even if no claims have run", () => {
    const status = computeOverallHealthStatus(true, null);
    expect(status).toBe("error");
  });

  it("reports 'error' when hasErrors is true, even if a recent claim processed", () => {
    const now = Date.now();
    const recentClaim = new Date(now - 30 * 1000); // 30 seconds ago
    const status = computeOverallHealthStatus(true, recentClaim, now);
    expect(status).toBe("error");
  });

  it("CRITICAL: reports 'error' (NOT 'degraded') when hasErrors is true and claims are stale", () => {
    // If Supabase or python_venv fails while claims are also stale,
    // the probe must return 'error' (503) so orchestration recognizes a dead worker.
    const now = Date.now();
    const staleClaim = new Date(now - 10 * 60 * 1000); // 10 minutes ago
    const status = computeOverallHealthStatus(true, staleClaim, now);
    expect(status).toBe("error");
  });

  it("tracks last claim timestamp via recordClaimProcessed", () => {
    expect(getLastClaimProcessedAt()).toBeNull();
    const before = new Date();
    recordClaimProcessed();
    const after = new Date();

    const recorded = getLastClaimProcessedAt();
    expect(recorded).not.toBeNull();
    expect(recorded!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(recorded!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("allows overriding and resetting test state", () => {
    const mockDate = new Date("2026-10-01T12:00:00Z");
    setLastClaimProcessedAtForTests(mockDate);
    expect(getLastClaimProcessedAt()).toEqual(mockDate);

    resetHealthStateForTests();
    expect(getLastClaimProcessedAt()).toBeNull();
  });
});

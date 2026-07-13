import { describe, expect, it } from "vitest";
import { assessIngestionHealth } from "../scripts/ingestion-autopilot";

const NOW = Date.parse("2026-07-13T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe("assessIngestionHealth", () => {
  it("reports unavailable (and not stuck) when Supabase is down", () => {
    const a = assessIngestionHealth({ ok: false, status: "supabase_unavailable" }, { now: NOW });
    expect(a.available).toBe(false);
    expect(a.stuck).toBe(false);
    expect(a.reasons).toContain("supabase unavailable");
  });

  it("is healthy when there are no failed or stale jobs", () => {
    const a = assessIngestionHealth(
      { ok: true, counts: { jobs_failed: 0 }, openJobs: [{ status: "pending" }] },
      { now: NOW },
    );
    expect(a.available).toBe(true);
    expect(a.stuck).toBe(false);
    expect(a.reasons).toHaveLength(0);
  });

  it("flags failed jobs as stuck", () => {
    const a = assessIngestionHealth({ ok: true, counts: { jobs_failed: 3 }, openJobs: [] }, { now: NOW });
    expect(a.stuck).toBe(true);
    expect(a.failedJobs).toBe(3);
    expect(a.reasons[0]).toContain("3 failed job");
  });

  it("flags a processing job whose lock is older than the stale threshold", () => {
    const a = assessIngestionHealth(
      {
        ok: true,
        counts: { jobs_failed: 0 },
        openJobs: [{ status: "processing", locked_at: minutesAgo(45) }],
      },
      { now: NOW, staleAfterMinutes: 30 },
    );
    expect(a.stuck).toBe(true);
    expect(a.staleProcessingJobs).toBe(1);
  });

  it("does not flag a recently-locked processing job", () => {
    const a = assessIngestionHealth(
      {
        ok: true,
        counts: { jobs_failed: 0 },
        openJobs: [{ status: "processing", locked_at: minutesAgo(5) }],
      },
      { now: NOW, staleAfterMinutes: 30 },
    );
    expect(a.stuck).toBe(false);
    expect(a.staleProcessingJobs).toBe(0);
  });
});

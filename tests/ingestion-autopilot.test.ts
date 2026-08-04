import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assessIngestionHealth } from "../scripts/ingestion-autopilot";

const autopilotSource = readFileSync(new URL("../scripts/ingestion-autopilot.ts", import.meta.url), "utf8");
const healthSource = readFileSync(new URL("../scripts/reindex-health.ts", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/ingestion-autopilot.yml", import.meta.url), "utf8");

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

  it("flags aged queued documents without open jobs as stuck", () => {
    const a = assessIngestionHealth(
      { ok: true, counts: { jobs_failed: 0, documents_stranded_queued: 2 }, openJobs: [] },
      { now: NOW },
    );
    expect(a.stuck).toBe(true);
    expect(a.strandedQueuedDocuments).toBe(2);
    expect(a.reasons).toContain("2 stranded queued document(s)");
  });

  it("wires scheduled detection to a durable alert and the existing bounded recovery path", () => {
    expect(healthSource).toContain('"documents_stranded_queued"');
    expect(autopilotSource).toContain('"--include-stranded-queued"');
    expect(autopilotSource).toContain('process.argv.includes("--alert-on-stuck")');
    expect(workflow).toContain("npm run ingestion:autopilot -- --alert-on-stuck");
    expect(workflow).toContain("--include-stranded-queued");
  });
});

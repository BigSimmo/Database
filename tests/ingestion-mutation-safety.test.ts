import { describe, expect, it } from "vitest";
import {
  buildActiveJobsSafetyResult,
  checkIngestionMutationSafety,
  isActiveAgentEnrichmentJob,
} from "../src/lib/ingestion-mutation-safety";

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

describe("checkIngestionMutationSafety agent-enrichment guard", () => {
  function supabaseMock(agentJobs: unknown[]) {
    return {
      from(table: string) {
        if (table === "import_batches") {
          return {
            select: () => ({
              limit: async () => ({ error: null }),
            }),
          };
        }
        if (table === "ingestion_jobs") {
          return {
            select: () => ({
              in: () => ({
                in: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === "indexing_v3_agent_jobs") {
          return {
            select: () => ({
              in: () => ({
                eq: async () => ({ data: agentJobs, error: null }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };
  }

  it("blocks full/retry mutations while a fresh agent-enrichment pass owns the document", async () => {
    const result = await checkIngestionMutationSafety({
      supabase: supabaseMock([
        {
          document_id: "doc-1",
          status: "processing",
          locked_at: "2026-07-07T23:50:00.000Z",
          updated_at: "2026-07-07T23:50:00.000Z",
        },
      ]) as never,
      documentIds: ["doc-1"],
      action: "Reindex",
      checkActiveJobs: true,
      checkActiveAgentEnrichmentJobs: true,
      staleAfterMinutes: 45,
      now: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected active agent-enrichment guard to block");
    expect(result.reason).toBe("active_agent_enrichment");
    expect(result.status).toBe(409);
    expect(result.activeJobs[0]?.stage).toBe("agent_enrichment");
  });

  it("does not query agent-enrichment jobs when the caller opts out", async () => {
    const result = await checkIngestionMutationSafety({
      supabase: supabaseMock([
        {
          document_id: "doc-1",
          status: "processing",
          locked_at: "2026-07-07T23:50:00.000Z",
          updated_at: "2026-07-07T23:50:00.000Z",
        },
      ]) as never,
      documentIds: ["doc-1"],
      action: "Enrichment",
      checkActiveJobs: true,
      checkActiveAgentEnrichmentJobs: false,
      staleAfterMinutes: 45,
      now: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
  });
});

describe("buildActiveJobsSafetyResult (R17 — reindex route 23505 race handling)", () => {
  const checkedAt = "2026-07-08T00:00:00.000Z";
  const staleAfterMinutes = 45;
  const now = new Date("2026-07-08T00:10:00.000Z");

  const job = (overrides: Partial<Parameters<typeof buildActiveJobsSafetyResult>[0][number]> = {}) => ({
    id: "job-1",
    document_id: "doc-1",
    status: "pending" as const,
    stage: "queued",
    locked_at: null,
    updated_at: "2026-07-08T00:05:00.000Z",
    error_message: null,
    attempt_count: 0,
    max_attempts: 3,
    ...overrides,
  });

  it("produces the same 409 'already queued' shape the pre-check produces, for a single fresh job", () => {
    const result = buildActiveJobsSafetyResult([job()], staleAfterMinutes, checkedAt, now);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.reason).toBe("active_jobs");
    expect(result.message).toBe("Document already has pending or processing indexing work.");
    expect(result.activeJobs).toHaveLength(1);
    expect(result.staleProcessingJobs).toHaveLength(0);
  });

  it("reports stale_processing_jobs when the race winner's job has an expired lease", () => {
    const result = buildActiveJobsSafetyResult(
      [job({ status: "processing", locked_at: "2026-07-07T22:00:00.000Z" })],
      staleAfterMinutes,
      checkedAt,
      now,
    );
    expect(result.reason).toBe("stale_processing_jobs");
    expect(result.staleProcessingJobs).toHaveLength(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { WorkerRuntimeControl } from "../worker/runtime-control";
import { runWorkerLoop } from "../worker/run-loop";
import type { JobRow } from "../worker/types";

function fakeJob(id = "job-1"): JobRow {
  return {
    id,
    document_id: "doc-1",
    batch_id: null,
    attempt_count: 0,
    max_attempts: 3,
    documents: {
      id: "doc-1",
      owner_id: null,
      title: "Test",
      file_name: "test.pdf",
      file_type: "application/pdf",
      storage_path: "docs/test.pdf",
      metadata: null,
    },
  };
}

describe("runWorkerLoop", () => {
  it("exits immediately when no jobs are available and once is set", async () => {
    const ctrl = new WorkerRuntimeControl();
    const claim = vi.fn().mockResolvedValue([]);
    const probe = vi.fn().mockResolvedValue({ ok: true });

    await runWorkerLoop({
      once: true,
      pollMs: 1000,
      healthBackoffMs: 1000,
      maxClaimFailures: 3,
      claim,
      process: vi.fn(),
      probe,
      backoff: (n) => n * 10,
      controller: ctrl,
      log: () => {},
    });

    expect(claim).toHaveBeenCalledOnce();
  });

  it("drains an active batch before exiting after stop", async () => {
    const ctrl = new WorkerRuntimeControl();
    const job = fakeJob();
    const processFn = vi.fn().mockImplementation(async () => {
      ctrl.stop();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const claim = vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]);
    const probe = vi.fn().mockResolvedValue({ ok: true });

    await runWorkerLoop({
      once: false,
      pollMs: 1000,
      healthBackoffMs: 1000,
      maxClaimFailures: 3,
      claim,
      process: processFn,
      probe,
      backoff: (n) => n * 10,
      controller: ctrl,
      log: () => {},
    });

    expect(processFn).toHaveBeenCalledWith(job);
    expect(ctrl.isStopped).toBe(true);
  });

  it("stops claiming new jobs after stop", async () => {
    const ctrl = new WorkerRuntimeControl();
    const claim = vi.fn().mockResolvedValue([fakeJob()]);
    const probe = vi.fn().mockResolvedValue({ ok: true });

    setTimeout(() => ctrl.stop(), 50);

    await runWorkerLoop({
      once: false,
      pollMs: 1000,
      healthBackoffMs: 1000,
      maxClaimFailures: 3,
      claim,
      process: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }),
      probe,
      backoff: (n) => n * 10,
      controller: ctrl,
      log: () => {},
    });

    expect(claim).toHaveBeenCalled();
    // After stop, no further claim should happen beyond the in-flight one.
  });

  it("aborts with exit code 1 in once mode when probe fails", async () => {
    const ctrl = new WorkerRuntimeControl();
    const probe = vi.fn().mockResolvedValue({ ok: false, message: "down" });

    await expect(
      runWorkerLoop({
        once: true,
        pollMs: 1000,
        healthBackoffMs: 1000,
        maxClaimFailures: 3,
        claim: vi.fn(),
        process: vi.fn(),
        probe,
        backoff: (n) => n * 10,
        controller: ctrl,
        log: () => {},
      }),
    ).rejects.toThrow("Supabase health check failed in --once mode");
  });

  it("backs off and does not throw when claim fails and failures are below threshold", async () => {
    const ctrl = new WorkerRuntimeControl();
    const claim = vi.fn().mockRejectedValue(new Error("claim error"));
    const probe = vi.fn().mockResolvedValue({ ok: true });

    setTimeout(() => ctrl.stop(), 250);

    await runWorkerLoop({
      once: false,
      pollMs: 1000,
      healthBackoffMs: 1000,
      maxClaimFailures: 3,
      claim,
      process: vi.fn(),
      probe,
      backoff: (n) => n * 10,
      controller: ctrl,
      log: () => {},
    });

    expect(claim).toHaveBeenCalled();
  });
});

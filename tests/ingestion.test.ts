import { describe, expect, it } from "vitest";
import { isRetryableIngestionError, nextRetryAt, retryDelayMs, terminalBatchStatus } from "../src/lib/ingestion";

describe("ingestion retry helpers", () => {
  it("classifies transient failures as retryable", () => {
    expect(isRetryableIngestionError(new Error("429 rate limit"))).toBe(true);
    expect(isRetryableIngestionError(new Error("network timeout"))).toBe(true);
    expect(isRetryableIngestionError(new Error("invalid pdf password"))).toBe(false);
  });

  it("backs off retry delays with a cap", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(3)).toBe(240_000);
    expect(retryDelayMs(20)).toBe(30 * 60_000);
  });

  it("produces terminal batch status from job counts", () => {
    expect(terminalBatchStatus({ queued: 1, processing: 0, failed: 0 })).toBe("processing");
    expect(terminalBatchStatus({ queued: 0, processing: 0, failed: 1 })).toBe("completed_with_errors");
    expect(terminalBatchStatus({ queued: 0, processing: 0, failed: 0 })).toBe("completed");
  });

  it("computes a future retry timestamp", () => {
    expect(Date.parse(nextRetryAt(1, new Date("2026-05-27T00:00:00.000Z")))).toBe(
      Date.parse("2026-05-27T00:01:00.000Z"),
    );
  });
});

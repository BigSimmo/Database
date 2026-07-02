import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerMain = readFileSync(new URL("../worker/main.ts", import.meta.url), "utf8");
const workerIndex = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");

describe("worker safe logging", () => {
  it("does not log raw ingestion job errors", () => {
    expect(workerMain).toContain('console.error("Ingestion job failed", safeErrorLogDetails(error))');
    expect(workerMain).not.toContain("console.error(`Ingestion job ${job.id} failed:`, error)");
  });
  it("sanitizes worker bootstrap fatal errors", () => {
    expect(workerIndex).toContain('console.error("Worker bootstrap failed", safeErrorLogDetails(error))');
  });
});

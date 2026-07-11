import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerMain = readFileSync(new URL("../worker/main.ts", import.meta.url), "utf8");
const workerIndex = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
const answerStreamRoute = readFileSync(new URL("../src/app/api/answer/stream/route.ts", import.meta.url), "utf8");
const httpLib = readFileSync(new URL("../src/lib/http.ts", import.meta.url), "utf8");
const seedFallbackFiles = [
  "../src/lib/registry-seed.ts",
  "../src/lib/medication-seed.ts",
  "../src/lib/differential-seed.ts",
  "../src/app/api/registry/records/[slug]/route.ts",
  "../src/app/api/medications/[slug]/route.ts",
  "../src/app/api/differentials/[slug]/route.ts",
  "../src/app/api/differentials/presentations/[slug]/route.ts",
].map((file) => readFileSync(new URL(file, import.meta.url), "utf8"));

describe("worker safe logging", () => {
  it("does not log raw ingestion job errors", () => {
    expect(workerMain).toContain('console.error("Ingestion job failed", safeErrorLogDetails(error))');
    expect(workerMain).not.toContain("console.error(`Ingestion job ${job.id} failed:`, error)");
  });
  it("sanitizes worker bootstrap fatal errors", () => {
    expect(workerIndex).toContain('console.error("Worker bootstrap failed", safeErrorLogDetails(error))');
  });

  it("sanitizes streaming answer route errors before logging", () => {
    expect(answerStreamRoute).toContain('logger.error("Search stream failed", safeErrorLogDetails(error))');
    expect(answerStreamRoute).not.toContain("stack: error instanceof Error ? error.stack");
  });

  it("sanitizes shared JSON API errors before logging", () => {
    expect(httpLib).toContain("...safeErrorLogDetails(error)");
    expect(httpLib).not.toContain("causeMessage: details?.causeMessage");
    expect(httpLib).not.toContain("stack: error instanceof Error ? error.stack");
  });

  it("sanitizes registry seed fallback errors before logging", () => {
    for (const file of seedFallbackFiles) {
      expect(file).toContain("safeErrorLogDetails(error)");
      expect(file).not.toContain("auto-seed failed for owner");
      expect(file).not.toMatch(/console\.error\([^)]*,\s*error\)/);
    }
  });
});

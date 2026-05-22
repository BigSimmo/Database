import { describe, expect, it } from "vitest";
import { safeErrorLogDetails, safeIngestionJobLog } from "../src/lib/privacy";

describe("privacy-safe logging helpers", () => {
  it("logs ingestion jobs by job id without document filenames", () => {
    const message = safeIngestionJobLog("job-123");

    expect(message).toBe("Processing ingestion job job-123");
    expect(message).not.toMatch(/pdf|docx|patient|guideline/i);
  });

  it("redacts error messages from log metadata", () => {
    const details = safeErrorLogDetails(new Error("secret storage path /users/patient/source.pdf"));

    expect(details).toEqual({ name: "Error" });
    expect(JSON.stringify(details)).not.toContain("source.pdf");
  });
});

import { describe, expect, it } from "vitest";
import { safeErrorLogDetails, safeIngestionJobLog } from "../src/lib/privacy";

describe("privacy-safe logging helpers", () => {
  it("logs ingestion jobs by job id without document filenames", () => {
    const message = safeIngestionJobLog("job-123");

    expect(message).toBe("Processing ingestion job job-123");
    expect(message).not.toMatch(/pdf|docx|patient|guideline/i);
  });

  it("logs sanitized error messages without filesystem paths", () => {
    const details = safeErrorLogDetails(new Error("secret storage path /users/patient/source.pdf"));

    expect(details).toMatchObject({ name: "Error", message: "secret storage path [path]" });
    expect(JSON.stringify(details)).not.toContain("source.pdf");
  });

  it("summarizes HTML error responses by title", () => {
    const error = {
      message: "<!DOCTYPE html><html><head><title>supabase.co | 522: Connection timed out</title></head></html>",
    };
    const details = safeErrorLogDetails(error);

    expect(details).toMatchObject({
      name: "object",
      message: "HTML response: supabase.co | 522: Connection timed out",
    });
    expect(JSON.stringify(details)).not.toContain("<!DOCTYPE html>");
  });

  it("does not repeat custom error messages as stack lines", () => {
    const error = new Error("<!DOCTYPE html>");
    error.name = "SupabaseRecoveryError";
    error.stack = "SupabaseRecoveryError: <!DOCTYPE html>\n<!--[if lt IE 7]> html marker\n    at safe.js:1:1";

    const details = safeErrorLogDetails(error);

    expect(details).toMatchObject({ name: "SupabaseRecoveryError", message: "<!DOCTYPE html>" });
    expect(details.stack).not.toContain("<!DOCTYPE html>");
    expect(details.stack).not.toContain("<!--[if");
  });
});

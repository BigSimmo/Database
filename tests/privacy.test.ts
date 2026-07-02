import { afterEach, describe, expect, it, vi } from "vitest";
import { safeErrorLogDetails, safeIngestionJobLog, redactCaptionIdentifiers } from "../src/lib/privacy";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

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

  it("redacts identifiers in captions while preserving clinical context", () => {
    const input = "Patient Jane Citizen MRN 123456 email jane@example.com phone 0400 123 456 has lithium level note.";
    const output = redactCaptionIdentifiers(input);

    expect(output).toContain("has lithium level note.");
    expect(output).not.toContain("jane@example.com");
    expect(output).not.toContain("123456");
    expect(output).not.toContain("0400 123 456");
  });

  it("preserves clinical numeric ranges while still redacting likely phone numbers", () => {
    const input = "Lithium therapeutic range 0.6 - 1.0 mmol/L. Ward contact: +61 400 123 456.";
    const output = redactCaptionIdentifiers(input);

    expect(output).toContain("0.6 - 1.0 mmol/L");
    expect(output).not.toContain("+61 400 123 456");
    expect(output).toContain("[phone]");
  });
});

describe("query privacy storage helpers", () => {
  it("stores only hash-derived placeholders for PHI-capable query text by default", async () => {
    vi.doMock("@/lib/env", () => ({ env: { RAG_PERSIST_RAW_QUERY_TEXT: false } }));
    const {
      normalizedQueryTextForStorage,
      queryCacheKeyForStorage,
      queryDerivedTokensForStorage,
      queryPrivacyMetadata,
      queryTextForStorage,
    } = await import("../src/lib/query-privacy");
    const query = "Patient Jane Citizen MRN 123456 born 01/02/1970 needs clozapine monitoring";

    const storedQuery = queryTextForStorage(query);
    const storedNormalizedQuery = normalizedQueryTextForStorage(query);
    const storedCacheKey = queryCacheKeyForStorage(`query:${query}`);
    const metadata = queryPrivacyMetadata(query);

    expect(storedQuery).toMatch(/^redacted-query:[a-f0-9]{64}$/);
    expect(storedNormalizedQuery).toBe(storedQuery);
    expect(storedCacheKey).toMatch(/^redacted-cache:[a-f0-9]{64}$/);
    expect(queryDerivedTokensForStorage(["jane", "123456", "clozapine"])).toEqual([]);
    expect(metadata).toMatchObject({
      query_hash: storedQuery.replace("redacted-query:", ""),
      raw_query_retained: false,
    });
    for (const value of [storedQuery, storedNormalizedQuery, storedCacheKey, JSON.stringify(metadata)]) {
      expect(value).not.toContain("Jane");
      expect(value).not.toContain("123456");
      expect(value).not.toContain("01/02/1970");
      expect(value).not.toContain("clozapine");
    }
  });

  it("retains raw and normalized text only when raw retention is explicitly enabled", async () => {
    vi.doMock("@/lib/env", () => ({ env: { RAG_PERSIST_RAW_QUERY_TEXT: true } }));
    const {
      normalizedQueryTextForStorage,
      queryCacheKeyForStorage,
      queryDerivedTokensForStorage,
      queryTextForStorage,
    } = await import("../src/lib/query-privacy");

    expect(queryTextForStorage("  Clozapine Monitoring  ")).toBe("  Clozapine Monitoring  ");
    expect(normalizedQueryTextForStorage("  Clozapine Monitoring  ")).toBe("clozapine monitoring");
    expect(queryCacheKeyForStorage("query:clozapine monitoring")).toBe("query:clozapine monitoring");
    expect(queryDerivedTokensForStorage(["clozapine"])).toEqual(["clozapine"]);
  });
});

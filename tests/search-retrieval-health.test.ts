import { describe, expect, it } from "vitest";

import { retrievalHealthFromTelemetry } from "@/lib/search-retrieval-health";

/**
 * Pins the third silent-zero class found alongside the scoped-to-zero defect.
 *
 * `searchTextChunkCandidates` swallows an RPC failure and returns `[]`, so a
 * broken retrieval layer reached the reader as a confident "no matches" behind
 * HTTP 200 — the same shape as a genuine miss. In a clinical corpus that reads
 * as "no guideline covers this", so the failure has to be recoverable from the
 * response rather than only from server telemetry.
 */
describe("retrievalHealthFromTelemetry", () => {
  it("reports nothing when every retrieval layer answered", () => {
    expect(retrievalHealthFromTelemetry({})).toBeNull();
    expect(retrievalHealthFromTelemetry({ hybrid_rpc_errors: {} })).toBeNull();
    expect(retrievalHealthFromTelemetry({ hybrid_rpc_errors: null })).toBeNull();
  });

  it("flags a failed lexical layer so an empty result is not read as absence", () => {
    expect(retrievalHealthFromTelemetry({ hybrid_rpc_errors: { match_document_chunks_text: "42883" } })).toEqual({
      degraded: true,
      reason: "retrieval_rpc_error:match_document_chunks_text",
    });
  });

  it("names every failed rpc, in a stable order", () => {
    // Sorted so the reason is comparable across requests: it is persisted in
    // telemetry, and an order that varied by iteration would fragment it.
    expect(
      retrievalHealthFromTelemetry({
        hybrid_rpc_errors: { match_documents_for_query: "PGRST202", match_document_chunks_text: "42883" },
      }),
    ).toEqual({
      degraded: true,
      reason: "retrieval_rpc_error:match_document_chunks_text,match_documents_for_query",
    });
  });

  it("carries rpc names only, never the query", () => {
    const health = retrievalHealthFromTelemetry({
      hybrid_rpc_errors: { match_document_chunks_text: "relation does not exist" },
    });
    // The reason is rendered, logged and persisted, so it must stay free of
    // anything the caller typed — the same constraint query-privacy applies to
    // every other stored search field.
    expect(health?.reason).toBe("retrieval_rpc_error:match_document_chunks_text");
    expect(health?.reason).not.toContain("relation does not exist");
  });
});

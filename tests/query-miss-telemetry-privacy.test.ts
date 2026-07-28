import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const searchRoute = readFileSync(new URL("../src/app/api/search/route.ts", import.meta.url), "utf8");
const interactionRoute = readFileSync(new URL("../src/app/api/search/interaction/route.ts", import.meta.url), "utf8");
const promotionReader = readFileSync(new URL("../scripts/promote-query-misses.ts", import.meta.url), "utf8");

describe("query-miss telemetry privacy", () => {
  it("persists stable identifiers and ranking facts instead of document display names", () => {
    const weakSearchWriter = searchRoute.slice(
      searchRoute.indexOf("function logWeakSearch"),
      searchRoute.indexOf("function telemetryLatencyMs"),
    );
    const observationWriter = searchRoute.slice(
      searchRoute.indexOf("function logSearchObservation"),
      searchRoute.indexOf("async function resolveSearchScope"),
    );

    expect(weakSearchWriter).toContain("top_files: []");
    expect(weakSearchWriter).toContain("top_chunk_ids:");
    expect(weakSearchWriter).not.toContain("result.file_name");
    expect(observationWriter).toContain("top_document_id:");
    expect(observationWriter).not.toContain("top_document_title");
    expect(observationWriter).not.toContain("top_file_name");
    expect(interactionRoute).toContain("top_files: []");
    expect(interactionRoute).toContain("candidate_labels: []");
    expect(interactionRoute).not.toContain("safeTelemetryText");
  });

  it("resolves historical and id-only rows at the authorized operator read boundary", () => {
    expect(promotionReader).toContain('.from("document_chunks")');
    expect(promotionReader).toContain('.select("id,document_id")');
    expect(promotionReader).toContain('.from("documents")');
    expect(promotionReader).toContain('.select("id,title,file_name")');
    expect(promotionReader).toContain("...(row.top_files ?? [])");
    expect(promotionReader).toContain("documentDisplayNames.byChunkId.get(chunkId)");
    expect(promotionReader).toContain("documentDisplayNames.byDocumentId.get(row.clicked_document_id)");
  });
});

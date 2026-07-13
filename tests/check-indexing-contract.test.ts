import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isEmptyIndexedDocument, type IndexingHealthDocument } from "../scripts/lib/indexing-health-document";

const source = readFileSync(new URL("../scripts/check-indexing.ts", import.meta.url), "utf8");
const smartBackfillSource = readFileSync(new URL("../scripts/backfill-smart-index.ts", import.meta.url), "utf8");

describe("indexing health scan", () => {
  it("uses bounded document batches large enough for the production corpus", () => {
    const batchSize = Number(source.match(/const documentIdBatchSize = (\d+);/)?.[1]);
    expect(batchSize).toBeGreaterThanOrEqual(50);
  });

  it("loads independent artifact families concurrently", () => {
    expect(source).toMatch(
      /const \[sections, memoryCards, chunks, tableFacts, embeddingFields, qualityRows\] = await Promise\.all/,
    );
    expect(source).toMatch(/const \[enrichmentRows, deepMemoryRows\] = await Promise\.all\(\[\s*loadEnrichmentRows/);
  });

  it("keeps lightweight registry projections in core search checks without requiring PDF artifacts", () => {
    expect(source).toContain("const richIndexedDocuments = indexedDocuments.filter");
    expect(source).toContain("searchable registry projections");
    expect(source).toContain("indexedDocuments.filter(isEmptyIndexedDocument)");

    const registryProjection: IndexingHealthDocument = {
      status: "indexed",
      file_name: "australian-medicine-handbook.registry.json",
      page_count: 0,
      chunk_count: 1,
      metadata: { source_kind: "registry_record", registry_record_id: "amh" },
    };

    expect(isEmptyIndexedDocument(registryProjection)).toBe(false);
    expect(isEmptyIndexedDocument({ ...registryProjection, chunk_count: 0 })).toBe(true);
    expect(isEmptyIndexedDocument({ ...registryProjection, file_name: "guideline.pdf" })).toBe(true);
  });
});

describe("smart-index repair selection", () => {
  it("does not combine an exact document id with an ambient owner default", () => {
    expect(smartBackfillSource).toContain("if (args.documentId) args.ownerId = undefined");
  });
});

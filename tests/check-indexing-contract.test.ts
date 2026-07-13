import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    expect(source).toContain('document.file_name?.endsWith(".registry.json")');
    expect(source).toContain('metadata.source_kind === "registry_record"');
    expect(source).toContain('typeof metadata.registry_record_id === "string"');
    expect(source).toContain("const richIndexedDocuments = indexedDocuments.filter");
    expect(source).toContain("searchable registry projections");
  });
});

describe("smart-index repair selection", () => {
  it("does not combine an exact document id with an ambient owner default", () => {
    expect(smartBackfillSource).toContain("if (args.documentId) args.ownerId = undefined");
  });
});

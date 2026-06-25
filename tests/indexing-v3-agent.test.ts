import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../supabase/functions/indexing-v3-agent/index.ts", import.meta.url),
  "utf8",
);

describe("indexing-v3-agent worker hardening", () => {
  it("uses the v3 document enrichment claim path and keeps legacy ingestion state in sync", () => {
    expect(source).toContain("claim_indexing_v3_agent_jobs");
    expect(source).toContain("markOpenIngestionJobsCompleted");
    expect(source).toContain("markOpenIngestionJobsDeferred");
  });

  it("bounds deferrals and records terminal missing-artifact state", () => {
    expect(source).toContain("INDEXING_V3_MAX_DEFERRALS");
    expect(source).toContain("needs_enrichment_artifacts");
    expect(source).toContain("indexing_v3_agent_deferral_count");
  });

  it("batches OpenAI embeddings with timeout and retry handling", () => {
    expect(source).toContain("OPENAI_EMBEDDING_BATCH_SIZE");
    expect(source).toContain("AbortController");
    expect(source).toContain("embeddingBatch");
    expect(source).toContain("OPENAI_MAX_RETRIES");
  });

  it("filters low-signal generated labels before satisfying the completion gate", () => {
    expect(source).toContain("LABEL_STOPWORDS");
    expect(source).toContain("phraseLabelCandidates");
    expect(source).toContain("isLowQualityLabel");
  });

  it("creates section-backed memory cards before applying the completion gate", () => {
    expect(source).toContain("upsertMemoryCardsFromSections");
    expect(source).toContain("document_memory_cards");
    expect(source).toContain("memory_cards_from_sections");
  });

  it("repairs missing sections from chunks before section index units are built", () => {
    expect(source).toContain("ensureSectionsFromChunks");
    expect(source).toContain("repaired_missing_sections");
    expect(source).toContain("repaired_sections");
  });
});

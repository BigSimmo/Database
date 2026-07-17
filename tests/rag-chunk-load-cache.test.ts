import { describe, expect, it, vi } from "vitest";
import { createChunkLoadCache, loadChunksForSignalMatches } from "../src/lib/rag-candidate-sources";

const chunk = {
  id: "chunk-1",
  document_id: "document-1",
  page_number: 1,
  chunk_index: 0,
  section_heading: "Evidence",
  section_path: [],
  heading_level: 1,
  parent_heading: null,
  anchor_id: null,
  content: "Recovered clinical evidence",
  retrieval_synopsis: null,
  image_ids: [],
  index_generation_id: "generation-1",
};

const document = {
  id: "document-1",
  owner_id: null,
  title: "Recovered document",
  file_name: "recovered.pdf",
  metadata: { index_generation_id: "generation-1" },
  status: "indexed",
};

const matches = [
  {
    chunkId: chunk.id,
    similarity: 0.8,
    textRank: 0.7,
    hybridScore: 0.9,
    reason: "section_context",
  },
];

function transientFailureClient(failOnResolution: number) {
  let resolutionCount = 0;

  class Query implements PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
    private ids: string[] | null = null;

    constructor(private readonly table: string) {}

    select() {
      return this;
    }

    limit() {
      return this;
    }

    in(column: string, values: string[]) {
      if (column === "id") this.ids = values;
      return this;
    }

    eq() {
      return this;
    }

    is() {
      return this;
    }

    or() {
      return this;
    }

    then<TResult1 = { data: unknown[] | null; error: { message: string } | null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown[] | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      resolutionCount += 1;
      if (resolutionCount === failOnResolution) {
        return Promise.resolve({ data: null, error: { message: "transient database failure" } }).then(
          onfulfilled,
          onrejected,
        );
      }

      const source = this.table === "documents" ? [document] : [chunk];
      const data = this.ids ? source.filter((row) => this.ids?.includes(row.id)) : source;
      return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
    }
  }

  return { from: vi.fn((table: string) => new Query(table)) } as never;
}

describe("request-scoped chunk hydration cache", () => {
  it.each([
    ["chunk scope", 1],
    ["document", 2],
    ["full chunk", 3],
  ])("retries after a transient %s fetch failure", async (_stage, failOnResolution) => {
    const cache = createChunkLoadCache();
    const supabase = transientFailureClient(failOnResolution);
    const args = {
      supabase,
      matches,
      accessScope: { includePublic: true } as const,
      cache,
    };

    await expect(loadChunksForSignalMatches(args)).resolves.toEqual([]);
    await expect(loadChunksForSignalMatches(args)).resolves.toMatchObject([{ id: "chunk-1" }]);
  });
});

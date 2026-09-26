import { describe, expect, it } from "vitest";
import { attachPageVisualEvidence, createDocumentRankingMetadataCache } from "../src/lib/rag/rag-hydration";
import type { SearchResult } from "../src/lib/types";

type ImageRow = {
  id: string;
  document_id: string;
  page_number: number | null;
  storage_path: string;
  caption: string;
  bbox: null;
  image_type: string;
  searchable: boolean;
  clinical_relevance_score: number;
  source_kind: string;
  width: null;
  height: null;
  labels: string[];
  metadata: Record<string, unknown>;
};

function image(id: string, documentId: string, page: number, score: number): ImageRow {
  return {
    id,
    document_id: documentId,
    page_number: page,
    storage_path: `${id}.png`,
    caption: id,
    bbox: null,
    image_type: "table",
    searchable: true,
    clinical_relevance_score: score,
    source_kind: "page_image",
    width: null,
    height: null,
    labels: [],
    metadata: {},
  };
}

function client(rows: ImageRow[]) {
  const reads: Array<{ kind: "page" | "direct"; ids?: string[] }> = [];
  class Query implements PromiseLike<{ data: ImageRow[]; error: null }> {
    private documentIds: string[] | null = null;
    private pages: number[] | null = null;
    private ids: string[] | null = null;
    private rowLimit = Infinity;
    private ordered = false;
    select() {
      return this;
    }
    in(column: string, values: unknown[]) {
      if (column === "document_id") this.documentIds = values as string[];
      if (column === "page_number") this.pages = values as number[];
      if (column === "id") this.ids = values as string[];
      return this;
    }
    eq() {
      return this;
    }
    neq() {
      return this;
    }
    order() {
      this.ordered = true;
      return this;
    }
    limit(count: number) {
      this.rowLimit = count;
      return this;
    }
    abortSignal() {
      return this;
    }
    then<TResult1 = { data: ImageRow[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: ImageRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      reads.push(this.ids ? { kind: "direct", ids: this.ids } : { kind: "page" });
      let data = rows.filter(
        (row) =>
          (!this.ids || this.ids.includes(row.id)) &&
          (!this.documentIds || this.documentIds.includes(row.document_id)) &&
          (!this.pages || this.pages.includes(row.page_number as number)),
      );
      if (this.ordered) data = [...data].sort((a, b) => b.clinical_relevance_score - a.clinical_relevance_score);
      return Promise.resolve({ data: data.slice(0, this.rowLimit), error: null }).then(onfulfilled, onrejected);
    }
  }
  return { supabase: { from: () => new Query() } as never, reads };
}

function result(id: string, documentId: string, page: number, sourceImageId?: string): SearchResult {
  return {
    id,
    document_id: documentId,
    page_number: page,
    images: [],
    source_metadata: {},
    index_unit: sourceImageId ? { source_image_id: sourceImageId } : undefined,
  } as unknown as SearchResult;
}

const imageIds = (results: SearchResult[]) => results.map((row) => (row.images ?? []).map((img) => img.id));

describe("page visual evidence reuse within one search", () => {
  const rows = [
    image("a1", "doc-a", 1, 0.9),
    image("a1b", "doc-a", 1, 0.4),
    image("a2", "doc-a", 2, 0.8),
    image("b1", "doc-b", 1, 0.7),
    image("b3", "doc-b", 3, 0.6),
    image("direct", "doc-c", 9, 0.5),
  ];

  it("serves a later call whose pages were all read already without another page read", async () => {
    const { supabase, reads } = client(rows);
    const cache = createDocumentRankingMetadataCache();
    const first = [result("r1", "doc-a", 1), result("r2", "doc-a", 2), result("r3", "doc-b", 1)];
    await attachPageVisualEvidence(supabase, first, undefined, cache);
    expect(reads).toHaveLength(1);

    const later = [result("r3", "doc-b", 1), result("r1", "doc-a", 1)];
    const cached = await attachPageVisualEvidence(supabase, later, undefined, cache);
    expect(reads).toHaveLength(1);
    const uncached = await attachPageVisualEvidence(client(rows).supabase, later);
    expect(cached).toEqual(uncached);
    expect(imageIds(cached)).toEqual([["b1"], ["a1", "a1b"]]);
  });

  it("reads again when a later call needs a page that was not covered", async () => {
    const { supabase, reads } = client(rows);
    const cache = createDocumentRankingMetadataCache();
    await attachPageVisualEvidence(supabase, [result("r1", "doc-a", 1)], undefined, cache);
    const later = [result("r1", "doc-a", 1), result("r4", "doc-b", 3)];
    const cached = await attachPageVisualEvidence(supabase, later, undefined, cache);
    expect(reads).toHaveLength(2);
    expect(cached).toEqual(await attachPageVisualEvidence(client(rows).supabase, later));
  });

  it("never reuses a page read that reached its row limit, since it may be missing rows", async () => {
    const many = Array.from({ length: 81 }, (_, index) =>
      image(`m${index}`, "doc-m", 1 + (index % 2), 1 - index / 100),
    );
    const { supabase, reads } = client(many);
    const cache = createDocumentRankingMetadataCache();
    const first = [result("r1", "doc-m", 1), result("r2", "doc-m", 2)];
    await attachPageVisualEvidence(supabase, first, undefined, cache);
    await attachPageVisualEvidence(supabase, [result("r2", "doc-m", 2)], undefined, cache);
    expect(reads).toHaveLength(2);
  });

  it("reads each directly linked image once, including ids with no qualifying row", async () => {
    const { supabase, reads } = client(rows);
    const cache = createDocumentRankingMetadataCache();
    const withDirect = [result("r1", "doc-a", 1, "direct"), result("r2", "doc-a", 2, "missing")];
    const first = await attachPageVisualEvidence(supabase, withDirect, undefined, cache);
    const second = await attachPageVisualEvidence(supabase, withDirect, undefined, cache);
    expect(reads.filter((read) => read.kind === "direct")).toEqual([{ kind: "direct", ids: ["direct", "missing"] }]);
    expect(second).toEqual(first);
    expect(imageIds(second)).toEqual([["direct", "a1", "a1b"], ["a2"]]);
  });
});

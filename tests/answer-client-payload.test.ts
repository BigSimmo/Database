import { describe, expect, it } from "vitest";

import { toClientAnswerPayload } from "@/lib/answer-client-payload";
import type { RagAnswer, SearchResult } from "@/lib/types";

function fullSource(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine monitoring guideline",
    file_name: "clozapine.pdf",
    page_number: 4,
    chunk_index: 7,
    section_heading: "Monitoring",
    content: "Full blood count weekly for 18 weeks. ".repeat(60),
    retrieval_synopsis: "FBC weekly for 18 weeks, then monthly.",
    image_ids: [],
    similarity: 0.82,
    source_metadata: { document_status: "current" } as SearchResult["source_metadata"],
    adjacent_context: "Preceding paragraph context. ".repeat(20),
    document_summary: "A long document summary. ".repeat(30),
    memory_cards: [{ id: "m1" } as never],
    table_facts: [{ id: "t1" } as never],
    index_unit: { unit_type: "table" } as never,
    ...overrides,
  } as SearchResult;
}

function answerWith(sources: SearchResult[]): Pick<RagAnswer, "sources"> {
  return { sources };
}

describe("toClientAnswerPayload", () => {
  it("drops server-only per-source fields the client never renders", () => {
    const trimmed = toClientAnswerPayload(answerWith([fullSource()])).sources![0];
    expect(trimmed.adjacent_context).toBeUndefined();
    expect(trimmed.memory_cards).toBeUndefined();
    expect(trimmed.table_facts).toBeUndefined();
    expect(trimmed.index_unit).toBeUndefined();
    expect(trimmed.document_summary).toBeUndefined();
  });

  it("keeps identity, snippet, scoring, and governance fields intact", () => {
    const trimmed = toClientAnswerPayload(answerWith([fullSource()])).sources![0];
    expect(trimmed.id).toBe("chunk-1");
    expect(trimmed.title).toBe("Clozapine monitoring guideline");
    expect(trimmed.retrieval_synopsis).toBe("FBC weekly for 18 weeks, then monthly.");
    expect(trimmed.similarity).toBe(0.82);
    expect(trimmed.source_metadata).toEqual({ document_status: "current" });
    expect(trimmed.page_number).toBe(4);
  });

  it("truncates long chunk content at a word boundary", () => {
    const trimmed = toClientAnswerPayload(answerWith([fullSource()])).sources![0];
    expect(trimmed.content.length).toBeLessThanOrEqual(701);
    expect(trimmed.content.endsWith("…")).toBe(true);
    // Word-boundary cut: no partial trailing token before the ellipsis.
    expect(trimmed.content.at(-2)).not.toBe(" ");
  });

  it("leaves short content untouched", () => {
    const short = fullSource({ content: "Short snippet." });
    expect(toClientAnswerPayload(answerWith([short])).sources![0].content).toBe("Short snippet.");
  });

  it("does not mutate the original answer (caches keep the full sources)", () => {
    const source = fullSource();
    const answer = answerWith([source]);
    toClientAnswerPayload(answer);
    expect(answer.sources![0].adjacent_context).toBeTruthy();
    expect(answer.sources![0].content.length).toBeGreaterThan(700);
  });

  it("passes through answers without sources", () => {
    const empty = answerWith([]);
    expect(toClientAnswerPayload(empty)).toBe(empty);
  });

  it("materially shrinks a representative payload", () => {
    const answer = answerWith(Array.from({ length: 8 }, (_, index) => fullSource({ id: `chunk-${index}` })));
    const fullBytes = JSON.stringify(answer).length;
    const trimmedBytes = JSON.stringify(toClientAnswerPayload(answer)).length;
    expect(trimmedBytes).toBeLessThan(fullBytes * 0.5);
  });
});

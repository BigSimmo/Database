import { describe, expect, it } from "vitest";
import {
  buildDocumentBreakdown,
  buildVisualEvidence,
  dedupeSearchResults,
  diversifySearchResults,
  extractQuoteCards,
  reconcileQuoteCards,
  selectBestSourceRecommendation,
} from "../src/lib/evidence";
import type { SearchResult } from "../src/lib/types";

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: "chunk-a",
    document_id: "doc-a",
    title: "Synthetic source",
    file_name: "source.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Monitoring",
    content:
      "Baseline monitoring is required. Escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
    image_ids: [],
    similarity: 0.9,
    images: [],
    ...overrides,
  };
}

describe("evidence helpers", () => {
  it("extracts short exact quote text from retrieved chunks", () => {
    const quotes = extractQuoteCards(
      [result({})],
      "What lithium toxicity symptoms need review?",
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0].quote).toContain("vomiting");
    expect(quotes[0].page_number).toBe(1);
  });

  it("uses image descriptions as quotable indexed evidence", () => {
    const quotes = extractQuoteCards(
      [
        result({
          id: "image-chunk",
          content:
            "[[IMAGE_DATA_START]] Image ID: img-1; Description: Synthetic table showing FBC/ANC, myocarditis, metabolic review, and constipation planning. [[IMAGE_DATA_END]]",
          image_ids: ["img-1"],
        }),
      ],
      "What monitoring items are shown in the table image?",
    );

    expect(quotes[0].quote).toContain("FBC/ANC");
    expect(quotes[0].quote).not.toContain("[[IMAGE_DATA_START]]");
  });

  it("groups sources by document and counts quote cards", () => {
    const sources = [
      result({ id: "a1", document_id: "doc-a", similarity: 0.81 }),
      result({ id: "a2", document_id: "doc-a", page_number: 2, similarity: 0.91 }),
      result({ id: "b1", document_id: "doc-b", title: "Second source", similarity: 0.75 }),
    ];
    const quotes = extractQuoteCards(sources, "monitoring escalation", 3);
    const breakdown = buildDocumentBreakdown(sources, quotes);

    expect(breakdown[0].document_id).toBe("doc-a");
    expect(breakdown[0].pages).toEqual([1, 2]);
    expect(breakdown[0].quote_count).toBeGreaterThan(0);
  });

  it("deduplicates near-identical chunks on the same page", () => {
    const sources = [
      result({ id: "a1" }),
      result({ id: "a2" }),
      result({ id: "a3", page_number: 2 }),
    ];

    expect(dedupeSearchResults(sources).map((source) => source.id)).toEqual(["a1", "a3"]);
  });

  it("caps document dominance when diversifying search results", () => {
    const sources = [
      result({ id: "a1", document_id: "doc-a", similarity: 0.98 }),
      result({ id: "a2", document_id: "doc-a", page_number: 2, content: "Second unique A source.", similarity: 0.97 }),
      result({ id: "a3", document_id: "doc-a", page_number: 3, content: "Third unique A source.", similarity: 0.96 }),
      result({ id: "b1", document_id: "doc-b", title: "Second source", content: "Unique B source.", similarity: 0.75 }),
    ];

    const diversified = diversifySearchResults(sources, 3, 2);

    expect(diversified.map((source) => source.id)).toContain("b1");
    expect(diversified.filter((source) => source.document_id === "doc-a")).toHaveLength(2);
  });

  it("falls back to locally extracted exact quotes when proposed quotes are not exact", () => {
    const sources = [result({ id: "a1" })];
    const quotes = reconcileQuoteCards(
      [
        {
          chunk_id: "a1",
          document_id: "doc-a",
          title: "Synthetic source",
          file_name: "source.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: "Monitoring",
          quote: "This wording is not present in the source.",
        },
      ],
      sources,
      "vomiting dehydration",
    );

    expect(quotes[0].quote).toContain("vomiting");
  });

  it("selects the best source by hybrid score before similarity", () => {
    const recommendation = selectBestSourceRecommendation([
      result({ id: "similarity-winner", similarity: 0.95, hybrid_score: 0.7 }),
      result({ id: "hybrid-winner", document_id: "doc-b", similarity: 0.82, hybrid_score: 0.91 }),
    ]);

    expect(recommendation?.chunk_id).toBe("hybrid-winner");
    expect(recommendation?.viewer_href).toBe("/documents/doc-b?page=1&chunk=hybrid-winner");
  });

  it("uses similarity as a tie-break for best source recommendations", () => {
    const recommendation = selectBestSourceRecommendation([
      result({ id: "lower-similarity", similarity: 0.72, hybrid_score: 0.8 }),
      result({ id: "higher-similarity", similarity: 0.88, hybrid_score: 0.8 }),
    ]);

    expect(recommendation?.chunk_id).toBe("higher-similarity");
  });

  it("falls back to similarity as the best-source score when hybrid score is absent", () => {
    const recommendation = selectBestSourceRecommendation([
      result({ id: "weaker-source", similarity: 0.71 }),
      result({ id: "stronger-source", document_id: "doc-strong", similarity: 0.89 }),
    ]);

    expect(recommendation?.chunk_id).toBe("stronger-source");
    expect(recommendation?.score).toBe(0.89);
  });

  it("prefers exact quote cards from the same source chunk", () => {
    const source = result({ id: "quoted-source" });
    const recommendation = selectBestSourceRecommendation([source], [
      {
        chunk_id: "quoted-source",
        document_id: "doc-a",
        title: "Synthetic source",
        file_name: "source.pdf",
        page_number: 1,
        chunk_index: 0,
        section_heading: "Monitoring",
        quote: "Escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
      },
    ]);

    expect(recommendation?.quote).toContain("Escalate review");
    expect(recommendation?.snippet).toContain("Escalate review");
  });

  it("does not recommend a best source without retrieved sources", () => {
    expect(selectBestSourceRecommendation([])).toBeNull();
  });

  it("builds visual evidence cards only from indexed source images", () => {
    const cards = buildVisualEvidence([
      result({
        id: "image-source",
        document_id: "doc-image",
        title: "Image source",
        file_name: "image-source.pdf",
        image_ids: ["img-1"],
        images: [
          {
            id: "img-1",
            page_number: 3,
            storage_path: "private/path/image.png",
            caption: "A source diagram extracted from the indexed PDF.",
          },
        ],
      }),
      result({ id: "text-source", document_id: "doc-text" }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0].image_id).toBe("img-1");
    expect(cards[0].signed_url_endpoint).toBe("/api/images/img-1/signed-url");
    expect(cards[0].viewer_href).toContain("page=3");
    expect(cards[0]).not.toHaveProperty("storage_path");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildCoveragePromptNote,
  buildIndexingCoverageProfile,
  selectCoverageAwarePromptChunks,
} from "../src/lib/indexing-coverage";

function chunk(index: number, content = `Routine page content ${index}.`) {
  return {
    id: `chunk-${index}`,
    page_number: index,
    chunk_index: index,
    section_heading: index % 5 === 0 ? `Section ${index}` : null,
    content,
  };
}

describe("indexing coverage", () => {
  it("records complete page and chunk coverage without hiding missing pages", () => {
    const profile = buildIndexingCoverageProfile({
      pageCount: 4,
      chunks: [chunk(1), chunk(2), chunk(4)],
      images: [{ id: "image-1", page_number: 4, caption: "Clinical table" }],
    });

    expect(profile).toMatchObject({
      chunk_count: 3,
      image_count: 1,
      page_coverage_count: 3,
      expected_page_count: 4,
      missing_page_numbers: [3],
      has_complete_page_chunk_coverage: false,
    });
  });

  it("selects coverage-aware enrichment chunks across large documents", () => {
    const chunks = Array.from({ length: 80 }, (_, index) =>
      chunk(
        index,
        index === 60
          ? "If ANC is < 1.5, stop clozapine and seek urgent specialist review."
          : `Routine source content ${index}.`,
      ),
    );

    const selected = selectCoverageAwarePromptChunks(chunks, 12);
    const ids = selected.chunks.map((item) => item.id);

    expect(selected.strategy).toBe("coverage_spread_high_yield_headings");
    expect(ids).toContain("chunk-0");
    expect(ids).toContain("chunk-79");
    expect(ids).toContain("chunk-60");
    expect(selected.chunks.length).toBeLessThanOrEqual(12);
  });

  it("makes prompt truncation explicit as excerpt selection, not lost indexing", () => {
    const profile = buildIndexingCoverageProfile({
      pageCount: 20,
      chunks: Array.from({ length: 20 }, (_, index) => chunk(index + 1)),
    });
    const note = buildCoveragePromptNote({
      profile,
      selectedChunkIds: ["chunk-1", "chunk-10", "chunk-20"],
    });

    expect(note).toContain("20 indexed chunks");
    expect(note).toContain("17 chunk(s) remain indexed and retrievable");
  });
});

import { describe, expect, it } from "vitest";
import { buildChunks, buildImageTag, chunkTextWithOverlap } from "../src/lib/chunking";

describe("chunkTextWithOverlap", () => {
  it("keeps short text as one chunk", () => {
    expect(chunkTextWithOverlap("Lithium monitoring is required.", 2000, 200)).toEqual([
      "Lithium monitoring is required.",
    ]);
  });

  it("creates overlapping chunks for long text", () => {
    const text = Array.from({ length: 40 }, (_, index) => `Sentence ${index}.`).join(" ");
    const chunks = chunkTextWithOverlap(text, 120, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(140);
    expect(chunks.join(" ")).toContain("Sentence 0.");
  });

  it("prefers paragraph boundaries before falling back to sentence windows", () => {
    const chunks = chunkTextWithOverlap("Heading\n\nFirst clinical paragraph.\n\nSecond clinical paragraph.", 32, 4);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain("Heading");
    expect(chunks[1]).toContain("First clinical paragraph");
  });
});

describe("image-aware chunks", () => {
  it("preserves image captions as inline searchable context", () => {
    const tag = buildImageTag({
      id: "image-1",
      caption: "Table showing lithium baseline monitoring.",
    });

    expect(tag).toContain("[[IMAGE_DATA_START]]");
    expect(tag).toContain("lithium baseline monitoring");
    expect(tag).toContain("[[IMAGE_DATA_END]]");
  });

  it("attaches referenced image ids to chunks", () => {
    const chunks = buildChunks([
      {
        documentId: "doc-1",
        pageNumber: 2,
        pageText: "Medication monitoring guidance.",
        metadata: { content_hash: "abc", embedding_model: "text-embedding-3-small" },
        images: [
          {
            id: "image-1",
            caption: "Medication monitoring flowchart.",
            pageNumber: 2,
          },
        ],
      },
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].image_ids).toContain("image-1");
    expect(chunks[0].page_number).toBe(2);
    expect(chunks[0].metadata).toMatchObject({
      content_hash: "abc",
      embedding_model: "text-embedding-3-small",
      page_start: 2,
      page_end: 2,
    });
  });
});

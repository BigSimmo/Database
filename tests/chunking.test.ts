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

  it("preserves table labels, titles, and extracted table text as searchable context", () => {
    const tag = buildImageTag({
      id: "table-1",
      caption: "Agitation management table.",
      imageType: "clinical_table",
      sourceKind: "table_crop",
      tableLabel: "Table 1",
      tableTitle: "Agitation and arousal rating scale and associated management",
      tableRole: "clinical",
      tableTextSnippet: "Score 5 | Highly aroused and violent toward others and/or property",
    });

    expect(tag).toContain("Source kind: table_crop");
    expect(tag).toContain("Table label: Table 1");
    expect(tag).toContain("Table role: clinical");
    expect(tag).toContain("Agitation and arousal rating scale");
    expect(tag).toContain("Score 5");
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
      source_spans: expect.arrayContaining([
        expect.objectContaining({
          page_number: 2,
          excerpt: expect.stringContaining("Medication monitoring guidance"),
        }),
      ]),
    });
  });

  it("caps inline image and table context so narrative chunks are not overwhelmed", () => {
    const chunks = buildChunks([
      {
        documentId: "doc-1",
        pageNumber: 3,
        pageText: "Clozapine monitoring narrative guidance for blood tests and escalation.",
        metadata: {},
        images: Array.from({ length: 5 }, (_, index) => ({
          id: `table-${index + 1}`,
          caption: `Clinical table ${index + 1}`,
          sourceKind: "table_crop",
          tableTitle: `Monitoring table ${index + 1}`,
          tableTextSnippet: "ANC threshold | withhold clozapine | repeat FBC",
          pageNumber: 3,
        })),
      },
    ]);

    const content = chunks.map((chunk) => chunk.content).join("\n");
    expect(content.match(/\[\[IMAGE_DATA_START\]\]/g)).toHaveLength(3);
    expect(content).toContain("additional image/table blocks");
    expect(content).toContain("Clozapine monitoring narrative guidance");
  });
});

describe("section-aware chunking groundwork", () => {
  it("carries the previous section path onto a following page without a new heading", () => {
    const chunks = buildChunks([
      {
        documentId: "doc-1",
        pageNumber: 1,
        pageText: "Clozapine Monitoring\n\nBaseline FBC and ANC monitoring applies.",
        metadata: {},
      },
      {
        documentId: "doc-1",
        pageNumber: 2,
        pageText: "Continue weekly blood-test monitoring until clinically stable.",
        metadata: {},
      },
    ]);

    const pageTwoChunk = chunks.find((chunk) => chunk.page_number === 2);
    expect(pageTwoChunk?.section_path).toContain("Clozapine Monitoring");
    expect(pageTwoChunk?.metadata.section_path).toContain("Clozapine Monitoring");
  });

  it("removes repeated page boilerplate while preserving clinical narrative", () => {
    const chunks = buildChunks([
      {
        documentId: "doc-1",
        pageNumber: 1,
        pageText:
          "Mental Health Guideline\n\nLithium Monitoring\n\nCheck renal function.\n\nPrinted uncontrolled document",
        metadata: {},
      },
      {
        documentId: "doc-1",
        pageNumber: 2,
        pageText:
          "Mental Health Guideline\n\nReview lithium levels after dose changes.\n\nPrinted uncontrolled document",
        metadata: {},
      },
    ]);

    const content = chunks.map((chunk) => chunk.content).join("\n");
    expect(content).not.toContain("Mental Health Guideline");
    expect(content).not.toContain("Printed uncontrolled document");
    expect(content).toContain("Check renal function");
    expect(content).toContain("Review lithium levels");
  });
});

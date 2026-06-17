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

  it("carries overlap across paragraph-path chunk boundaries (IDX-H5)", () => {
    // Three distinct paragraphs that together exceed chunkSize, forcing a flush. With
    // overlap the start of a later chunk must repeat the tail of the previous one so a
    // clinical instruction spanning a paragraph boundary keeps shared context.
    const paraA = `If ANC falls below 0.5 then ${"alpha ".repeat(20)}`.trim();
    const paraB = `withhold clozapine and escalate ${"bravo ".repeat(20)}`.trim();
    const paraC = `Repeat the full blood count daily ${"charlie ".repeat(20)}`.trim();
    const text = [paraA, paraB, paraC].join("\n\n");

    const chunks = chunkTextWithOverlap(text, 200, 60);

    expect(chunks.length).toBeGreaterThan(1);
    // At least one later chunk should begin with content carried from the previous chunk's
    // tail (overlap present), rather than starting cleanly at a new paragraph.
    const hasOverlap = chunks.slice(1).some((chunk, index) => {
      const previous = chunks[index];
      const tailWords = previous.split(/\s+/).slice(-4).join(" ");
      return tailWords.length > 0 && chunk.includes(tailWords);
    });
    expect(hasOverlap).toBe(true);
  });

  it("keeps a small markdown table atomic instead of splitting it as prose (IDX-H6)", () => {
    const table = [
      "| Parameter | Threshold | Action |",
      "| --- | --- | --- |",
      "| ANC | < 0.5 | Withhold clozapine |",
      "| ANC | 0.5-1.0 | Repeat FBC daily |",
    ].join("\n");
    const text = `Monitoring guidance.\n\n${table}\n\nFollow up as needed.`;

    const chunks = chunkTextWithOverlap(text, 2000, 200);
    const tableChunk = chunks.find((chunk) => chunk.includes("| Parameter | Threshold | Action |"));
    expect(tableChunk).toBeDefined();
    // The whole table stays together in a single chunk: header + both data rows.
    expect(tableChunk).toContain("| ANC | < 0.5 | Withhold clozapine |");
    expect(tableChunk).toContain("| ANC | 0.5-1.0 | Repeat FBC daily |");
  });

  it("splits an oversized table on row boundaries and repeats the header (IDX-H6)", () => {
    const header = ["| Parameter | Threshold | Action |", "| --- | --- | --- |"];
    const rows = Array.from(
      { length: 30 },
      (_, index) => `| Row ${index} | < ${index}.0 | Withhold and escalate clinical response ${index} |`,
    );
    const table = [...header, ...rows].join("\n");

    const chunks = chunkTextWithOverlap(table, 400, 40);
    const tableChunks = chunks.filter((chunk) => chunk.includes("| Parameter | Threshold | Action |"));

    // Multiple chunks, and every table chunk repeats the header row so values are never
    // severed from their column headers.
    expect(tableChunks.length).toBeGreaterThan(1);
    for (const chunk of tableChunks) {
      expect(chunk).toContain("| Parameter | Threshold | Action |");
    }
    // No data row is lost across the split.
    const combined = tableChunks.join("\n");
    for (let index = 0; index < 30; index += 1) {
      expect(combined).toContain(`| Row ${index} |`);
    }
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

import { describe, expect, it } from "vitest";
import { parseExtractedDocumentPayload } from "../src/lib/extractors/document";

describe("Python extracted-document payload validation", () => {
  it("accepts the extractor contract", () => {
    expect(
      parseExtractedDocumentPayload(
        JSON.stringify({
          pages: [{ pageNumber: 1, text: "Clinical source text", ocrUsed: true }],
          images: [
            {
              pageNumber: 1,
              path: "C:/tmp/page-1-table.png",
              mimeType: "image/png",
              bbox: [10, 20, 300, 180],
              width: 290,
              height: 160,
              sourceKind: "table_crop",
              metadata: { table_title: "Monitoring thresholds" },
            },
          ],
          warnings: [],
        }),
      ),
    ).toMatchObject({
      pages: [{ pageNumber: 1, text: "Clinical source text", ocrUsed: true }],
      images: [{ pageNumber: 1, sourceKind: "table_crop" }],
    });
  });

  it.each([
    {
      name: "non-string page text",
      payload: { pages: [{ pageNumber: 1, text: 42 }], images: [] },
    },
    {
      name: "an incomplete image bounding box",
      payload: {
        pages: [],
        images: [{ pageNumber: 1, path: "table.png", mimeType: "image/png", bbox: [0, 0, 20] }],
      },
    },
    {
      name: "an image without a path",
      payload: { pages: [], images: [{ pageNumber: 1, mimeType: "image/png" }] },
    },
  ])("rejects $name", ({ payload }) => {
    expect(() => parseExtractedDocumentPayload(JSON.stringify(payload))).toThrow();
  });
});

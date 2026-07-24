import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("document image re-enrichment retention", () => {
  it("keeps existing retained viewer images non-searchable", () => {
    const script = source("scripts/enrich-documents.ts");

    expect(script).toContain("const existingRetainedForView = existingMetadata.retained_for_document_view === true");
    expect(script).toContain("const nextSearchable = !existingRetainedForView && finalAssessment.searchable");
    expect(script).toContain('["table_crop", "diagram_crop", "page_region"].includes(image.source_kind ?? "")');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { demoDocuments, demoImages, getDemoImage } from "@/lib/demo-data";
import { toDocumentMatch } from "@/lib/document-enrichment";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import type { RelatedDocument } from "@/lib/types";

const extractorSource = readFileSync(new URL("../worker/python/extract_pdf_assets.py", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../worker/main.ts", import.meta.url), "utf8");
const backfillSource = readFileSync(new URL("../scripts/backfill-document-covers.mjs", import.meta.url), "utf8");

describe("document cover thumbnails", () => {
  it("pages cover backfill with stable ORDER BY for PostgREST range scans", () => {
    expect(backfillSource).toContain('.eq("source_kind", "cover_page")');
    expect(backfillSource).toMatch(
      /\.eq\("source_kind", "cover_page"\)\s*\n\s*\.order\("id", \{ ascending: true \}\)\s*\n\s*\.range\(from, from \+ 999\)/,
    );
    expect(backfillSource).toMatch(
      /\.order\("created_at", \{ ascending: true \}\)\s*\n\s*\.order\("id", \{ ascending: true \}\)\s*\n\s*\.range\(from, from \+ 999\)/,
    );
  });

  it("audits every selected PDF and repairs missing objects or cover metadata", () => {
    expect(backfillSource).toContain('const all = hasFlag("--all")');
    expect(backfillSource).toContain("coversByDocument.get(String(doc.id))");
    expect(backfillSource).toContain("existingObjectIsLive");
    expect(backfillSource).toContain("recovered cover metadata");
    expect(backfillSource).toContain('supabase.from("document_images").update(imageRow).eq("id", existingCover.id)');
    expect(backfillSource).not.toContain("coveredIds.has(String(doc.id))");
  });

  it("extracts a first-page cover_page artifact in the PDF worker", () => {
    expect(extractorSource).toContain("def save_cover_page(");
    expect(extractorSource).toContain('"sourceKind": "cover_page"');
    expect(extractorSource).toContain("Optional cover after searchable artifacts");
  });

  it("persists covers as non-searchable display artifacts outside retrieval inputs", () => {
    expect(workerSource).toContain('image.sourceKind === "cover_page"');
    expect(workerSource).toContain('const retainAsCover = image.sourceKind === "cover_page"');
    expect(workerSource).toContain("cover_image_id: coverImageId");
    expect(workerSource).toContain('candidate.sourceKind !== "cover_page"');
    expect(workerSource).toContain("if (data.searchable !== false) {");
  });

  it("excludes cover pages from clinical image evidence", () => {
    expect(
      isClinicalImageEvidence({
        searchable: false,
        source_kind: "cover_page",
        image_type: "unclear",
        clinicalUseClass: "decorative_or_empty",
      }),
    ).toBe(false);
    expect(
      isClinicalImageEvidence({
        searchable: true,
        sourceKind: "cover_page",
        image_type: "unclear",
      }),
    ).toBe(false);
  });

  it("wires demo cover images onto every demo document and DocumentMatch", () => {
    for (const document of demoDocuments) {
      const cover = demoImages.find((image) => image.document_id === document.id && image.source_kind === "cover_page");
      expect(cover).toBeTruthy();
      expect(cover?.searchable).toBe(false);
      expect(getDemoImage(cover!.id)?.signed_url).toMatch(/-cover\.png$/);
    }

    const related: RelatedDocument = {
      document_id: demoDocuments[0].id,
      title: demoDocuments[0].title,
      file_name: demoDocuments[0].file_name,
      labels: [],
      summary: null,
      best_pages: [1],
      best_chunk_ids: ["chunk-1"],
      image_count: 0,
      table_count: 0,
      cover_image_id: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0",
      match_reason: "Matched 1 indexed passage",
      score: 1,
    };
    expect(toDocumentMatch(related).coverImageId).toBe("c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0");
  });
});

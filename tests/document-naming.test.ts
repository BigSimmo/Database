import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { documentTitleKey, planDocumentName, smartDocumentTitle } from "../src/lib/document-naming";

function supabaseWithDocuments(documents: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: documents, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("document naming", () => {
  it("creates readable titles from compact clinical filenames", () => {
    expect(smartDocumentTitle("MHSP.AgitationArousalPharmaMgt.pdf")).toBe(
      "MHSP - Agitation Arousal Pharmacological Management",
    );
    expect(smartDocumentTitle("clozapine_pres_admin_monitor_v5.0.pdf")).toBe(
      "Clozapine Prescribing Administering Monitoring V5.0",
    );
  });

  it("uses stable duplicate keys for equivalent names", () => {
    expect(documentTitleKey("Guideline (Copy 2)")).toBe(documentTitleKey("Guideline"));
  });

  it("keeps first upload title clean when no same-name document exists", async () => {
    const plan = await planDocumentName({
      supabase: supabaseWithDocuments([]),
      ownerId: "owner",
      fileName: "guideline.pdf",
      contentHash: "hash-1",
    });

    expect(plan).toMatchObject({
      title: "Guideline",
      baseTitle: "Guideline",
      duplicateIndex: 1,
      duplicateReason: "none",
    });
  });

  it("adds a clear suffix when a different document has the same title or filename", async () => {
    const plan = await planDocumentName({
      supabase: supabaseWithDocuments([
        { id: "doc-1", title: "Guideline", file_name: "guideline.pdf", content_hash: "hash-1" },
      ]),
      ownerId: "owner",
      fileName: "guideline.pdf",
      contentHash: "hash-2",
    });

    expect(plan).toMatchObject({
      title: "Guideline (Copy 2)",
      baseTitle: "Guideline",
      duplicateIndex: 2,
      duplicateReason: "same_title_or_filename",
    });
  });

  it("prefers a version/date suffix from the uploaded filename when available", async () => {
    const plan = await planDocumentName({
      supabase: supabaseWithDocuments([
        { id: "doc-1", title: "Clozapine Prescribing", file_name: "clozapine_prescribing.pdf", content_hash: "hash-1" },
      ]),
      ownerId: "owner",
      fileName: "clozapine_prescribing_v5.0.pdf",
      requestedTitle: "Clozapine Prescribing",
      contentHash: "hash-2",
    });

    expect(plan.title).toBe("Clozapine Prescribing (v5.0)");
  });
});
